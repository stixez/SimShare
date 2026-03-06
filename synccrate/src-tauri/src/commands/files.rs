use crate::registry::{self, GameDefinition};
use crate::state::{AppState, FileInfo, FileManifest};
use crate::utils;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use walkdir::WalkDir;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct HashCacheEntry {
    size: u64,
    mtime: u64,
    hash: String,
}

type HashCache = HashMap<String, HashCacheEntry>;

fn load_hash_cache() -> HashCache {
    let path = utils::hash_cache_path();
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(cache) = serde_json::from_str(&data) {
                return cache;
            }
        }
    }
    HashMap::new()
}

fn save_hash_cache(cache: &HashCache) {
    let path = utils::hash_cache_path();
    if let Ok(data) = serde_json::to_string(cache) {
        let _ = std::fs::write(&path, data);
    }
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
pub struct GameConfig {
    pub game_paths: HashMap<String, String>,
    pub active_game: Option<String>,
    #[serde(default)]
    pub user_library: Vec<String>,
}

pub fn load_game_config() -> GameConfig {
    let path = utils::game_config_path();
    if path.exists() {
        if let Ok(data) = std::fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<GameConfig>(&data) {
                return config;
            }
        }
    }
    GameConfig::default()
}

pub(crate) fn save_game_config(app_state: &AppState) {
    let config = GameConfig {
        game_paths: app_state.game_paths.clone(),
        active_game: Some(app_state.active_game.clone()),
        user_library: app_state.user_library.clone(),
    };
    let path = utils::game_config_path();
    if let Ok(data) = serde_json::to_string_pretty(&config) {
        let _ = std::fs::write(&path, data);
    }
}

/// Resolve a game ID string, accepting both new registry IDs and legacy enum variant names.
pub(crate) fn resolve_game(app_state: &AppState, game_str: &str) -> Result<String, String> {
    let registry_map = registry::build_registry_map(&app_state.game_registry);
    let legacy_map = registry::build_legacy_map(&app_state.game_registry);
    registry::resolve_game_id(game_str, &registry_map, &legacy_map)
        .ok_or_else(|| format!("Unknown game: {}", game_str))
}

/// Get the GameDefinition for a game ID.
pub(crate) fn get_game_def<'a>(registry: &'a crate::registry::GameRegistry, game_id: &str) -> Option<&'a GameDefinition> {
    registry.games.iter().find(|g| g.id == game_id)
}

fn scan_directory(
    base_path: &str,
    sub_dir: &str,
    file_type_fn: impl Fn(&str) -> String + Sync,
    valid_extensions: &[String],
    compute_hashes: bool,
    hash_cache: &HashCache,
) -> HashMap<String, FileInfo> {
    let dir = std::path::PathBuf::from(base_path).join(sub_dir);
    let mut files = HashMap::new();

    if !dir.exists() {
        return files;
    }

    let ext_refs: Vec<&str> = valid_extensions.iter().map(|s| s.as_str()).collect();

    // Collect eligible file entries first, then hash in parallel
    let entries: Vec<_> = WalkDir::new(&dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|entry| {
            if entry.path_is_symlink() || !entry.path().is_file() {
                return false;
            }
            // If extensions list is non-empty, filter by them
            if !ext_refs.is_empty() {
                let ext = entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                ext_refs.contains(&ext.as_str())
            } else {
                true
            }
        })
        .collect();

    let results: Vec<_> = entries
        .par_iter()
        .filter_map(|entry| {
            let path = entry.path();
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();

            let relative = path
                .strip_prefix(base_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string()
                .replace('\\', "/");

            let metadata = std::fs::metadata(path).ok()?;
            let file_size = metadata.len();

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);

            let hash = if compute_hashes {
                let cache_key = path.to_string_lossy().replace('\\', "/");
                if let Some(cached) = hash_cache.get(&cache_key) {
                    if cached.size == file_size && cached.mtime == modified {
                        cached.hash.clone()
                    } else {
                        compute_file_hash(path).ok()?
                    }
                } else {
                    compute_file_hash(path).ok()?
                }
            } else {
                String::new()
            };

            let file_type = file_type_fn(&ext);

            Some((
                relative.clone(),
                FileInfo {
                    relative_path: relative,
                    size: file_size,
                    hash,
                    modified,
                    file_type,
                },
            ))
        })
        .collect();

    for (key, info) in results {
        files.insert(key, info);
    }

    files
}

fn compute_file_hash(path: &std::path::Path) -> Result<String, String> {
    use std::io::Read;
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut reader = std::io::BufReader::with_capacity(131072, file);
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 131072];
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
    game: Option<String>,
    quick: Option<bool>,
) -> Result<FileManifest, String> {
    let compute_hashes = !quick.unwrap_or(false);
    let (base_path, game_def) = {
        let mut app_state = state.lock().await;
        let game_id = match game {
            Some(ref g) => resolve_game(&app_state, g)?,
            None => app_state.active_game.clone(),
        };
        let path = app_state
            .game_paths
            .get(&game_id)
            .cloned()
            .or_else(|| {
                let detected = utils::detect_game_path_from_registry(&game_id, &app_state.game_registry);
                if let Some(ref p) = detected {
                    app_state.game_paths.insert(game_id.clone(), p.clone());
                }
                detected
            })
            .ok_or_else(|| {
                format!(
                    "{} path not found. Please set it manually.",
                    app_state.game_label(&game_id)
                )
            })?;
        let def = get_game_def(&app_state.game_registry, &game_id)
            .ok_or_else(|| format!("Game '{}' not found in registry", game_id))?
            .clone();
        (path, def)
    };

    let manifest = tokio::task::spawn_blocking(move || {
        let hash_cache = if compute_hashes { load_hash_cache() } else { HashMap::new() };

        let mut all_files = HashMap::new();

        // Data-driven scanning: iterate content types from registry
        for ct in &game_def.content_types {
            let classify = ct.classify_by_extension.clone();
            let default_ft = ct.file_type.clone();
            let exts = ct.extensions.clone();

            let files = scan_directory(
                &base_path,
                &ct.folder,
                move |ext| {
                    classify.get(ext).cloned().unwrap_or_else(|| default_ft.clone())
                },
                &exts,
                compute_hashes,
                &hash_cache,
            );
            all_files.extend(files);
        }

        // Update hash cache with current scan results
        if compute_hashes {
            let mut new_cache = HashCache::new();
            for info in all_files.values() {
                if !info.hash.is_empty() {
                    let abs_path = std::path::PathBuf::from(&base_path)
                        .join(&info.relative_path)
                        .to_string_lossy()
                        .replace('\\', "/");
                    new_cache.insert(abs_path, HashCacheEntry {
                        size: info.size,
                        mtime: info.modified,
                        hash: info.hash.clone(),
                    });
                }
            }
            save_hash_cache(&new_cache);
        }

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
pub async fn get_game_path(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game: String,
) -> Result<String, String> {
    let app_state = state.lock().await;
    let game_id = resolve_game(&app_state, &game)?;
    app_state
        .game_paths
        .get(&game_id)
        .cloned()
        .or_else(|| utils::detect_game_path_from_registry(&game_id, &app_state.game_registry))
        .ok_or_else(|| format!("{} path not found", app_state.game_label(&game_id)))
}

#[tauri::command]
pub async fn set_game_path(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game: String,
    path: String,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    let game_id = resolve_game(&app_state, &game)?;
    let game_def = get_game_def(&app_state.game_registry, &game_id)
        .ok_or_else(|| format!("Game '{}' not found in registry", game_id))?
        .clone();

    let game_dir = std::path::Path::new(&path);
    if !game_dir.exists() {
        return Err("Path does not exist".to_string());
    }

    let mut canonical = utils::clean_path(
        std::fs::canonicalize(game_dir)
            .map_err(|e| format!("Cannot resolve path: {}", e))?,
    );

    // Auto-correct if user selected a known subfolder
    if let Some(pc) = &game_def.path_correction {
        if let Some(folder_name) = canonical.file_name().and_then(|n| n.to_str()) {
            let folder_str = folder_name.to_string();

            // Check nested corrections first (e.g., AddOns -> go up 2 levels)
            if let Some(&levels) = pc.nested_corrections.get(&folder_str) {
                for _ in 0..levels {
                    if let Some(parent) = canonical.parent() {
                        canonical = parent.to_path_buf();
                    }
                }
            } else if pc.known_subfolders.iter().any(|s| s.eq_ignore_ascii_case(&folder_str)) {
                if let Some(parent) = canonical.parent() {
                    canonical = parent.to_path_buf();
                }
            }
        }
    }

    // Validate or create expected directories
    if let Some(val) = &game_def.validation {
        let any_exists = val.check_dirs.is_empty()
            || val.check_dirs.iter().any(|d| canonical.join(d).exists());

        if !any_exists && !val.auto_create_dirs.is_empty() {
            for dir in &val.auto_create_dirs {
                std::fs::create_dir_all(canonical.join(dir))
                    .map_err(|e| format!("Cannot create {} folder: {}", dir, e))?;
            }
        }
    }

    app_state.game_paths.insert(game_id, canonical.to_string_lossy().to_string());
    save_game_config(&app_state);
    Ok(())
}

#[tauri::command]
pub async fn get_active_game(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<String, String> {
    let app_state = state.lock().await;
    Ok(app_state.active_game.clone())
}

#[tauri::command]
pub async fn set_active_game(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game: String,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    let game_id = resolve_game(&app_state, &game)?;
    app_state.active_game = game_id;
    save_game_config(&app_state);
    Ok(())
}

#[tauri::command]
pub async fn toggle_mod(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    relative_path: String,
    enabled: bool,
) -> Result<String, String> {
    let (base, first_content_folder) = {
        let app_state = state.lock().await;
        let base = app_state
            .game_paths
            .get(&app_state.active_game)
            .cloned()
            .ok_or("Game path not set")?;
        let folder = get_game_def(&app_state.game_registry, &app_state.active_game)
            .and_then(|d| d.content_types.first())
            .map(|ct| ct.folder.clone())
            .unwrap_or_else(|| "Mods".to_string());
        (base, folder)
    };

    let full_path = utils::safe_join(&base, &relative_path)?;
    if !full_path.exists() {
        return Err("File not found".into());
    }

    let mods_dir = std::path::PathBuf::from(&base).join(&first_content_folder);
    let disabled_dir = mods_dir.join("_Disabled");

    let filename = full_path
        .file_name()
        .ok_or("Invalid filename")?
        .to_os_string();

    if enabled {
        let dest = mods_dir.join(&filename);
        if dest.exists() {
            return Err(format!("A file with that name already exists in {}", first_content_folder));
        }
        std::fs::rename(&full_path, &dest).map_err(|e| e.to_string())?;
        let new_rel = dest
            .strip_prefix(&base)
            .unwrap_or(&dest)
            .to_string_lossy()
            .replace('\\', "/");
        Ok(new_rel)
    } else {
        std::fs::create_dir_all(&disabled_dir).map_err(|e| e.to_string())?;
        let dest = disabled_dir.join(&filename);
        if dest.exists() {
            return Err("A file with that name already exists in _Disabled".into());
        }
        std::fs::rename(&full_path, &dest).map_err(|e| e.to_string())?;
        let new_rel = dest
            .strip_prefix(&base)
            .unwrap_or(&dest)
            .to_string_lossy()
            .replace('\\', "/");
        Ok(new_rel)
    }
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".into());
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_all_game_paths(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<HashMap<String, Option<String>>, String> {
    let app_state = state.lock().await;
    let mut result = HashMap::new();
    for game in &app_state.game_registry.games {
        result.insert(game.id.clone(), app_state.game_paths.get(&game.id).cloned());
    }
    Ok(result)
}

// --- New commands for game registry and library ---

#[tauri::command]
pub async fn get_game_registry(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<registry::GameDefinition>, String> {
    let app_state = state.lock().await;
    Ok(app_state.game_registry.games.clone())
}

#[tauri::command]
pub async fn get_user_library(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<Vec<String>, String> {
    let app_state = state.lock().await;
    Ok(app_state.user_library.clone())
}

#[tauri::command]
pub async fn add_to_library(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game_id: String,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    if !app_state.game_registry.games.iter().any(|g| g.id == game_id) {
        return Err(format!("Unknown game: {}", game_id));
    }
    if !app_state.user_library.contains(&game_id) {
        app_state.user_library.push(game_id);
        save_game_config(&app_state);
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_from_library(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    game_id: String,
) -> Result<(), String> {
    let mut app_state = state.lock().await;
    app_state.user_library.retain(|id| id != &game_id);
    save_game_config(&app_state);
    Ok(())
}

#[tauri::command]
pub async fn detect_installed_games(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<HashMap<String, String>, String> {
    let app_state = state.lock().await;
    let registry = app_state.game_registry.clone();
    drop(app_state);

    let result = tokio::task::spawn_blocking(move || {
        let mut detected = HashMap::new();
        for game in &registry.games {
            if game.auto_detect {
                if let Some(path) = utils::detect_game_path_from_def(game) {
                    detected.insert(game.id.clone(), path);
                }
            }
        }
        detected
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(result)
}
