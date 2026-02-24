use crate::state::{AppState, FileType, ModProfile, ProfileMod};
use crate::utils::{self, sanitize_id};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[tauri::command]
pub async fn list_profiles() -> Result<Vec<ModProfile>, String> {
    let dir = utils::profiles_dir();
    let mut profiles = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(data) = std::fs::read_to_string(&path) {
                    if let Ok(profile) = serde_json::from_str::<ModProfile>(&data) {
                        profiles.push(profile);
                    }
                }
            }
        }
    }

    profiles.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(profiles)
}

#[tauri::command]
pub async fn save_profile(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    name: String,
    desc: String,
    icon: String,
) -> Result<ModProfile, String> {
    let app_state = state.lock().await;

    let mods: Vec<ProfileMod> = app_state
        .local_manifest
        .files
        .values()
        .filter(|f| f.file_type == FileType::Mod || f.file_type == FileType::CustomContent)
        .map(|f| ProfileMod {
            relative_path: f.relative_path.clone(),
            hash: f.hash.clone(),
            size: f.size,
            name: std::path::Path::new(&f.relative_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string(),
        })
        .collect();

    let profile = ModProfile {
        id: Uuid::new_v4().to_string(),
        name,
        description: desc,
        icon,
        author: whoami::fallible::hostname().unwrap_or_else(|_| "Unknown".to_string()),
        created_at: utils::timestamp_now(),
        mods,
    };

    let dir = utils::profiles_dir();
    let path = dir.join(format!("{}.json", profile.id));
    let data = serde_json::to_string_pretty(&profile).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub async fn load_profile(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    id: String,
) -> Result<(), String> {
    sanitize_id(&id)?;
    let app_state = state.lock().await;
    let _base = app_state.sims4_path.as_ref().ok_or("Sims 4 path not set")?;

    let dir = utils::profiles_dir();
    let path = dir.join(format!("{}.json", id));
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let _profile: ModProfile = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Profile loading would compare manifest and enable/disable mods
    // For now, this is a placeholder
    Ok(())
}

#[tauri::command]
pub async fn export_profile(id: String, dest: String) -> Result<(), String> {
    sanitize_id(&id)?;
    let dir = utils::profiles_dir();
    let src = dir.join(format!("{}.json", id));
    let data = std::fs::read_to_string(&src).map_err(|e| e.to_string())?;

    let dest_path = if dest.ends_with(".simsync-profile") {
        dest
    } else {
        format!("{}.simsync-profile", dest)
    };

    std::fs::write(&dest_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn import_profile(path: String) -> Result<ModProfile, String> {
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let profile: ModProfile = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Validate the deserialized profile ID before using it in a file path
    sanitize_id(&profile.id)?;
    let dir = utils::profiles_dir();
    let dest = dir.join(format!("{}.json", profile.id));
    std::fs::write(&dest, &data).map_err(|e| e.to_string())?;

    Ok(profile)
}

#[tauri::command]
pub async fn delete_profile(id: String) -> Result<(), String> {
    sanitize_id(&id)?;
    let dir = utils::profiles_dir();
    let path = dir.join(format!("{}.json", id));
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    Ok(())
}
