use crate::network::transfer;
use crate::state::{AppState, Resolution, SyncAction, SyncPlan};
use crate::sync::diff;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn compute_sync_plan(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<SyncPlan, String> {
    let mut app_state = state.lock().await;

    if app_state.local_manifest.files.is_empty() {
        return Err("No files scanned. Scan your files first.".to_string());
    }

    let remote = app_state
        .remote_manifest
        .as_ref()
        .ok_or("No remote manifest available. Connect to a peer first.")?;

    let plan = diff::compute_diff(&app_state.local_manifest, remote);
    app_state.sync_plan = Some(plan.clone());
    Ok(plan)
}

#[tauri::command]
pub async fn execute_sync(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let (plan, base_path) = {
        let mut app_state = state.lock().await;
        if app_state.is_syncing {
            return Err("Sync is already in progress".to_string());
        }
        let plan = app_state.sync_plan.take().ok_or("No sync plan computed.")?;

        // Prevent sync while unresolved conflicts exist
        let has_conflicts = plan.actions.iter().any(|a| matches!(a, SyncAction::Conflict { .. }));
        if has_conflicts {
            app_state.sync_plan = Some(plan);
            return Err("Resolve all conflicts before syncing".to_string());
        }

        let base = app_state.sims4_path.clone().ok_or("Sims 4 path not set")?;
        app_state.is_syncing = true;
        (plan, base)
    };

    // Run sync and ensure is_syncing is always reset
    let result = run_sync(&state, &app, &plan, &base_path).await;

    {
        let mut app_state = state.lock().await;
        app_state.is_syncing = false;
    }

    result
}

async fn run_sync(
    state: &tauri::State<'_, Arc<Mutex<AppState>>>,
    app: &tauri::AppHandle,
    plan: &SyncPlan,
    base_path: &str,
) -> Result<(), String> {
    let total_files = plan.actions.len() as u64;
    let mut files_done = 0u64;
    let mut sync_errors: Vec<String> = Vec::new();
    let state_arc = state.inner().clone();

    for action in &plan.actions {
        match action {
            SyncAction::ReceiveFromRemote(file_info) => {
                let _ = app.emit(
                    "sync-progress",
                    serde_json::json!({
                        "file": file_info.relative_path,
                        "bytes_sent": 0,
                        "bytes_total": plan.total_bytes,
                        "files_done": files_done,
                        "files_total": total_files,
                    }),
                );

                match transfer::request_file(
                    &state_arc,
                    &file_info.relative_path,
                    base_path,
                )
                .await
                {
                    Ok(()) => {
                        files_done += 1;
                    }
                    Err(e) => {
                        sync_errors.push(format!("{}: {}", file_info.relative_path, e));
                        let _ = app.emit(
                            "sync-error",
                            serde_json::json!({"message": format!("Failed to receive {}: {}", file_info.relative_path, e)}),
                        );
                    }
                }
            }
            SyncAction::SendToRemote(file_info) => {
                // The remote side will request files from us via the TCP handler.
                // Mark as done — the host serves files on demand.
                files_done += 1;
                let _ = app.emit(
                    "sync-progress",
                    serde_json::json!({
                        "file": file_info.relative_path,
                        "bytes_sent": file_info.size,
                        "bytes_total": plan.total_bytes,
                        "files_done": files_done,
                        "files_total": total_files,
                    }),
                );
            }
            SyncAction::Delete(path) => {
                match crate::utils::safe_join(base_path, path) {
                    Ok(full_path) => {
                        if let Err(e) = tokio::fs::remove_file(&full_path).await {
                            sync_errors.push(format!("Delete {}: {}", path, e));
                        }
                    }
                    Err(e) => {
                        sync_errors.push(format!("Delete {}: path rejected: {}", path, e));
                    }
                }
                files_done += 1;
            }
            SyncAction::Conflict { .. } => {
                // Skip conflicts — must be resolved individually first
            }
        }
    }

    let _ = app.emit(
        "sync-complete",
        serde_json::json!({
            "files_synced": files_done,
            "total_bytes": plan.total_bytes,
            "errors": sync_errors,
        }),
    );

    if !sync_errors.is_empty() {
        return Err(format!("{} file(s) failed to sync", sync_errors.len()));
    }

    Ok(())
}

#[tauri::command]
pub async fn resolve_conflict(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    path: String,
    resolution: Resolution,
) -> Result<(), String> {
    let mut app_state = state.lock().await;

    if app_state.is_syncing {
        return Err("Cannot resolve conflicts while sync is in progress".to_string());
    }

    // Clone remote file info before mutating sync_plan to satisfy borrow checker
    let remote_file = app_state
        .remote_manifest
        .as_ref()
        .and_then(|m| m.files.get(&path))
        .cloned();

    if let Some(ref mut plan) = app_state.sync_plan {
        plan.actions.retain(|action| {
            if let SyncAction::Conflict { local, .. } = action {
                return local.relative_path != path;
            }
            true
        });

        match resolution {
            Resolution::KeepMine => {}
            Resolution::UseTheirs => {
                if let Some(remote) = remote_file {
                    plan.actions.push(SyncAction::ReceiveFromRemote(remote));
                }
            }
            Resolution::KeepBoth => {
                if let Some(mut renamed) = remote_file {
                    let p = std::path::Path::new(&path);
                    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
                    let stem = p.file_stem().and_then(|e| e.to_str()).unwrap_or("file");
                    let parent = p
                        .parent()
                        .map(|pp| pp.to_string_lossy().to_string())
                        .unwrap_or_default();

                    renamed.relative_path = if parent.is_empty() {
                        if ext.is_empty() {
                            format!("{}_remote", stem)
                        } else {
                            format!("{}_remote.{}", stem, ext)
                        }
                    } else if ext.is_empty() {
                        format!("{}/{}_remote", parent, stem)
                    } else {
                        format!("{}/{}_remote.{}", parent, stem, ext)
                    };

                    plan.actions.push(SyncAction::ReceiveFromRemote(renamed));
                }
            }
        }
    }

    Ok(())
}
