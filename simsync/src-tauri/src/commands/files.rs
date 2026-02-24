use crate::state::{AppState, FileInfo, FileManifest, FileType};
use crate::utils;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use walkdir::WalkDir;

fn scan_directory(base_path: &str, sub_dir: &str, file_type_fn: impl Fn(&str) -> FileType) -> HashMap<String, FileInfo> {
    let dir = std::path::PathBuf::from(base_path).join(sub_dir);
    let mut files = HashMap::new();

    if !dir.exists() {
        return files;
    }

    for entry in WalkDir::new(&dir).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        // Skip symlinks to prevent escaping base directory
        if entry.path_is_symlink() {
            continue;
        }
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if sub_dir == "Mods" && ext != "package" && ext != "ts4script" {
            continue;
        }

        let relative = path
            .strip_prefix(base_path)
            .unwrap_or(path)
            .to_string_lossy()
            .to_string()
            .replace('\\', "/"); // Normalize to forward slashes for cross-platform compat

        let metadata = match std::fs::metadata(path) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let hash = match compute_file_hash(path) {
            Ok(h) => h,
            Err(_) => continue,
        };

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let file_type = file_type_fn(&ext);

        files.insert(
            relative.clone(),
            FileInfo {
                relative_path: relative,
                size: metadata.len(),
                hash,
                modified,
                file_type,
            },
        );
    }

    files
}

fn compute_file_hash(path: &std::path::Path) -> Result<String, String> {
    use std::io::Read;
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut reader = std::io::BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = reader.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[tauri::command]
pub async fn scan_files(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<FileManifest, String> {
    let base_path = {
        let mut app_state = state.lock().await;
        let path = app_state
            .sims4_path
            .clone()
            .or_else(|| utils::detect_sims4_path())
            .ok_or("Sims 4 path not found. Please set it manually.")?;
        if app_state.sims4_path.is_none() {
            app_state.sims4_path = Some(path.clone());
        }
        path
    };

    let manifest = tokio::task::spawn_blocking(move || {
        let mods = scan_directory(&base_path, "Mods", |ext| {
            if ext == "ts4script" {
                FileType::Mod
            } else {
                FileType::CustomContent
            }
        });

        let saves = scan_directory(&base_path, "Saves", |_| FileType::Save);

        let mut all_files = mods;
        all_files.extend(saves);

        FileManifest {
            files: all_files,
            generated_at: utils::timestamp_now(),
        }
    })
    .await
    .map_err(|e| e.to_string())?;

    let mut app_state = state.lock().await;
    app_state.local_manifest = manifest.clone();
    Ok(manifest)
}

#[tauri::command]
pub async fn get_sims4_path(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let app_state = state.lock().await;
    app_state
        .sims4_path
        .clone()
        .or_else(|| utils::detect_sims4_path())
        .ok_or("Sims 4 path not found".to_string())
}

#[tauri::command]
pub async fn set_sims4_path(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    path: String,
) -> Result<(), String> {
    let sims4 = std::path::Path::new(&path);
    if !sims4.exists() {
        return Err("Path does not exist".to_string());
    }
    let mut app_state = state.lock().await;
    app_state.sims4_path = Some(path);
    Ok(())
}
