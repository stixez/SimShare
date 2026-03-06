use crate::commands::files::resolve_game;
use crate::state::{AppState, GameInfo, ModCompatibility};
use std::sync::Arc;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn detect_packs(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game: Option<String>,
) -> Result<GameInfo, String> {
    let (game_id, game_path) = {
        let app_state = state.lock().await;
        let gid = match game {
            Some(ref g) => resolve_game(&app_state, g)?,
            None => app_state.active_game.clone(),
        };
        let path = app_state
            .game_paths
            .get(&gid)
            .cloned()
            .ok_or_else(|| format!("Game path not set for {}", app_state.game_label(&gid)))?;
        (gid, path)
    };

    let gid_clone = game_id.clone();
    let info = tokio::task::spawn_blocking(move || {
        crate::packs::detect_game_info(&gid_clone, &game_path)
    })
    .await
    .map_err(|e| e.to_string())?;

    let mut app_state = state.lock().await;
    app_state.game_info.insert(game_id, info.clone());

    Ok(info)
}

#[tauri::command]
pub async fn get_game_info(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game: Option<String>,
) -> Result<GameInfo, String> {
    let app_state = state.lock().await;
    let game_id = match game {
        Some(ref g) => resolve_game(&app_state, g)?,
        None => app_state.active_game.clone(),
    };
    Ok(app_state
        .game_info
        .get(&game_id)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
pub async fn check_compatibility(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game: Option<String>,
) -> Result<Vec<ModCompatibility>, String> {
    let app_state = state.lock().await;
    let game_id = match game {
        Some(ref g) => resolve_game(&app_state, g)?,
        None => app_state.active_game.clone(),
    };
    let game_info = app_state
        .game_info
        .get(&game_id)
        .cloned()
        .unwrap_or_default();
    let manifest = &app_state.local_manifest;

    // Look up packs key from registry
    let packs_key = app_state.game_registry.games.iter()
        .find(|g| g.id == game_id)
        .and_then(|g| g.packs.as_deref())
        .unwrap_or("");

    Ok(crate::packs::check_mod_compatibility(
        manifest,
        &game_info,
        packs_key,
    ))
}
