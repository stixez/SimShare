mod commands;
mod network;
mod state;
mod sync;
mod utils;
mod watcher;

use state::AppState;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

pub fn run() {
    env_logger::init();

    let app_state = Arc::new(Mutex::new(AppState::default()));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();
            let state: tauri::State<'_, Arc<Mutex<AppState>>> = app.state();
            let state_clone = state.inner().clone();

            tauri::async_runtime::spawn(async move {
                // Detect path outside the lock
                let path = utils::detect_sims4_path();

                if let Some(path) = path {
                    let mods = utils::mods_path(&path);
                    let saves = utils::saves_path(&path);

                    // Start file watcher before acquiring lock
                    let watcher_result = watcher::file_watcher::start_watching(
                        &mods.to_string_lossy(),
                        &saves.to_string_lossy(),
                        handle,
                    );

                    // Acquire lock only to update state
                    let mut app_state = state_clone.lock().await;
                    app_state.sims4_path = Some(path);
                    // Store watcher so it lives as long as AppState
                    if let Ok(w) = watcher_result {
                        app_state.file_watcher = Some(w);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::session::start_host,
            commands::session::start_join,
            commands::session::connect_to_peer,
            commands::session::disconnect,
            commands::session::get_session_status,
            commands::files::scan_files,
            commands::files::get_sims4_path,
            commands::files::set_sims4_path,
            commands::sync::compute_sync_plan,
            commands::sync::execute_sync,
            commands::sync::resolve_conflict,
            commands::profiles::list_profiles,
            commands::profiles::save_profile,
            commands::profiles::load_profile,
            commands::profiles::export_profile,
            commands::profiles::import_profile,
            commands::profiles::delete_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
