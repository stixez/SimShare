use crate::commands::files::resolve_game;
use crate::state::{AppState, ModProfile, ProfileComparison, ProfileMod};
use crate::utils::{self, sanitize_id};
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[tauri::command]
pub async fn list_profiles(game: Option<String>) -> Result<Vec<ModProfile>, String> {
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

    // Filter by game if specified (game is now a string ID)
    if let Some(ref game_filter) = game {
        profiles.retain(|p| p.game == *game_filter);
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
    game: Option<String>,
) -> Result<ModProfile, String> {
    if name.trim().is_empty() || name.len() > 128 {
        return Err("Profile name must be 1-128 characters".to_string());
    }
    if desc.len() > 1024 {
        return Err("Description must be under 1024 characters".to_string());
    }

    let app_state = state.lock().await;

    let target_game = match game {
        Some(ref g) => resolve_game(&app_state, g)?,
        None => app_state.active_game.clone(),
    };

    // Get the primary content types for this game to filter mods
    let game_def = crate::commands::files::get_game_def(&app_state.game_registry, &target_game);
    let mod_file_types: Vec<String> = game_def
        .map(|def| {
            def.content_types
                .first()
                .map(|ct| {
                    let mut types = vec![ct.file_type.clone()];
                    types.extend(ct.classify_by_extension.values().cloned());
                    types
                })
                .unwrap_or_default()
        })
        .unwrap_or_else(|| vec!["Mod".to_string(), "CustomContent".to_string()]);

    let mods: Vec<ProfileMod> = app_state
        .local_manifest
        .files
        .values()
        .filter(|f| mod_file_types.contains(&f.file_type))
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
        author: if app_state.local_display_name.is_empty() {
            "Unknown".to_string()
        } else {
            app_state.local_display_name.clone()
        },
        created_at: utils::timestamp_now(),
        mods,
        game: target_game,
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
) -> Result<ProfileComparison, String> {
    sanitize_id(&id)?;
    let app_state = state.lock().await;
    let _base = app_state.active_game_path()?;

    let dir = utils::profiles_dir();
    let path = dir.join(format!("{}.json", id));
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let profile: ModProfile = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    // Get mod file types for the profile's game
    let game_def = crate::commands::files::get_game_def(&app_state.game_registry, &profile.game);
    let mod_file_types: Vec<String> = game_def
        .map(|def| {
            def.content_types
                .first()
                .map(|ct| {
                    let mut types = vec![ct.file_type.clone()];
                    types.extend(ct.classify_by_extension.values().cloned());
                    types
                })
                .unwrap_or_default()
        })
        .unwrap_or_else(|| vec!["Mod".to_string(), "CustomContent".to_string()]);

    let current_mods: std::collections::HashMap<String, String> = app_state
        .local_manifest
        .files
        .values()
        .filter(|f| mod_file_types.contains(&f.file_type))
        .map(|f| (f.relative_path.clone(), f.hash.clone()))
        .collect();

    let mut missing = Vec::new();
    let mut modified = Vec::new();
    let mut matched = Vec::new();

    for pm in &profile.mods {
        match current_mods.get(&pm.relative_path) {
            None => missing.push(pm.relative_path.clone()),
            Some(hash) if hash != &pm.hash => modified.push(pm.relative_path.clone()),
            _ => matched.push(pm.relative_path.clone()),
        }
    }

    let profile_paths: std::collections::HashSet<&str> =
        profile.mods.iter().map(|m| m.relative_path.as_str()).collect();
    let extra: Vec<String> = current_mods
        .keys()
        .filter(|p| !profile_paths.contains(p.as_str()))
        .cloned()
        .collect();

    Ok(ProfileComparison {
        profile_name: profile.name,
        matched: matched.len(),
        missing,
        modified,
        extra,
    })
}

#[tauri::command]
pub async fn export_profile(id: String, dest: String) -> Result<(), String> {
    sanitize_id(&id)?;
    let dir = utils::profiles_dir();
    let src = dir.join(format!("{}.json", id));
    let data = std::fs::read_to_string(&src).map_err(|e| e.to_string())?;

    let dest_path = if dest.ends_with(".synccrate-profile") || dest.ends_with(".simshare-profile") {
        dest
    } else {
        format!("{}.synccrate-profile", dest)
    };

    std::fs::write(&dest_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn import_profile(path: String) -> Result<ModProfile, String> {
    let data = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let profile: ModProfile = serde_json::from_str(&data).map_err(|e| e.to_string())?;

    sanitize_id(&profile.id)?;

    for m in &profile.mods {
        let p = std::path::Path::new(&m.relative_path);
        if p.is_absolute() {
            return Err(format!("Invalid mod path (absolute): {}", m.relative_path));
        }
        for component in p.components() {
            if matches!(component, std::path::Component::ParentDir) {
                return Err(format!("Invalid mod path (traversal): {}", m.relative_path));
            }
        }
    }

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
