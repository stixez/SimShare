use crate::state::{AppState, SimsGame};
use crate::utils;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

const MAX_INSTALL_FILE_SIZE: u64 = 2 * 1024 * 1024 * 1024; // 2 GB

fn parse_game(game: &str) -> Result<SimsGame, String> {
    match game {
        "Sims2" => Ok(SimsGame::Sims2),
        "Sims3" => Ok(SimsGame::Sims3),
        "Sims4" => Ok(SimsGame::Sims4),
        _ => Err(format!("Unknown game: {}", game)),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallResult {
    pub source: String,
    pub destination: String,
    pub status: InstallStatus,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InstallStatus {
    Success,
    Duplicate,
    InvalidExtension,
    Failed,
}

fn file_hash(path: &Path) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("Cannot read file: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(hex::encode(hasher.finalize()))
}

#[tauri::command]
pub async fn install_mod_files(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    file_paths: Vec<String>,
    game: Option<String>,
) -> Result<Vec<InstallResult>, String> {
    let (base, target_game) = {
        let app_state = state.lock().await;
        let target_game = match game {
            Some(ref g) => parse_game(g)?,
            None => app_state.active_game.clone(),
        };
        let path = app_state.active_game_path()?;
        (path, target_game)
    };

    let valid_extensions = utils::valid_mod_extensions(&target_game);
    let mods_dir = utils::mods_path(&base);
    if !mods_dir.exists() {
        std::fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
    }

    let mut results = Vec::new();

    for source_str in &file_paths {
        let source = Path::new(source_str);

        // Validate the source file exists
        if !source.is_file() {
            results.push(InstallResult {
                source: source_str.clone(),
                destination: String::new(),
                status: InstallStatus::Failed,
                message: Some("File does not exist".into()),
            });
            continue;
        }

        // Validate extension
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !valid_extensions.contains(&ext.as_str()) {
            let supported: Vec<String> = valid_extensions.iter().map(|e| format!(".{}", e)).collect();
            results.push(InstallResult {
                source: source_str.clone(),
                destination: String::new(),
                status: InstallStatus::InvalidExtension,
                message: Some(format!(
                    "Invalid extension '.{}'. Supported for {}: {}",
                    ext,
                    utils::game_label(&target_game),
                    supported.join(", ")
                )),
            });
            continue;
        }

        // Validate file size
        let metadata = std::fs::metadata(source).map_err(|e| e.to_string())?;
        if metadata.len() > MAX_INSTALL_FILE_SIZE {
            results.push(InstallResult {
                source: source_str.clone(),
                destination: String::new(),
                status: InstallStatus::Failed,
                message: Some("File exceeds 2 GB size limit".into()),
            });
            continue;
        }

        let file_name = source
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");

        // Sanitize filename: reject path traversal or embedded separators
        if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") || file_name.contains('\0') {
            results.push(InstallResult {
                source: source_str.clone(),
                destination: String::new(),
                status: InstallStatus::Failed,
                message: Some("Invalid filename".into()),
            });
            continue;
        }

        let dest = mods_dir.join(file_name);

        // Check for duplicate
        if dest.exists() {
            let source_hash = match file_hash(source) {
                Ok(h) => h,
                Err(e) => {
                    results.push(InstallResult {
                        source: source_str.clone(),
                        destination: dest.to_string_lossy().to_string(),
                        status: InstallStatus::Failed,
                        message: Some(e),
                    });
                    continue;
                }
            };
            let dest_hash = match file_hash(&dest) {
                Ok(h) => h,
                Err(e) => {
                    results.push(InstallResult {
                        source: source_str.clone(),
                        destination: dest.to_string_lossy().to_string(),
                        status: InstallStatus::Failed,
                        message: Some(e),
                    });
                    continue;
                }
            };

            if source_hash == dest_hash {
                results.push(InstallResult {
                    source: source_str.clone(),
                    destination: dest.to_string_lossy().to_string(),
                    status: InstallStatus::Duplicate,
                    message: Some("Identical file already exists".into()),
                });
            } else {
                results.push(InstallResult {
                    source: source_str.clone(),
                    destination: dest.to_string_lossy().to_string(),
                    status: InstallStatus::Duplicate,
                    message: Some("File with same name but different content exists".into()),
                });
            }
            continue;
        }

        // Copy file
        match std::fs::copy(source, &dest) {
            Ok(_) => {
                results.push(InstallResult {
                    source: source_str.clone(),
                    destination: dest.to_string_lossy().to_string(),
                    status: InstallStatus::Success,
                    message: None,
                });
            }
            Err(e) => {
                results.push(InstallResult {
                    source: source_str.clone(),
                    destination: dest.to_string_lossy().to_string(),
                    status: InstallStatus::Failed,
                    message: Some(format!("Copy failed: {}", e)),
                });
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn confirm_install_duplicate(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    source: String,
    strategy: String,
    game: Option<String>,
) -> Result<InstallResult, String> {
    let base = {
        let app_state = state.lock().await;
        match game {
            Some(ref g) => {
                let target_game = parse_game(g)?;
                app_state.game_paths.get(&target_game).cloned()
                    .ok_or_else(|| format!("{} path not set", utils::game_label(&target_game)))?
            }
            None => app_state.active_game_path()?,
        }
    };

    let mods_dir = utils::mods_path(&base);
    let source_path = Path::new(&source);

    if !source_path.is_file() {
        return Err("Source file no longer exists".into());
    }

    let file_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename")?;

    // Sanitize
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") || file_name.contains('\0') {
        return Err("Invalid filename".into());
    }

    match strategy.as_str() {
        "overwrite" => {
            let dest = mods_dir.join(file_name);
            std::fs::copy(source_path, &dest).map_err(|e| e.to_string())?;
            Ok(InstallResult {
                source,
                destination: dest.to_string_lossy().to_string(),
                status: InstallStatus::Success,
                message: Some("Overwritten".into()),
            })
        }
        "rename" => {
            let stem = source_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("file");
            let ext = source_path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");

            let mut counter = 1u32;
            let mut dest = mods_dir.join(format!("{}_{}.{}", stem, counter, ext));
            while dest.exists() {
                counter += 1;
                if counter > 999 {
                    return Err("Too many duplicates".into());
                }
                dest = mods_dir.join(format!("{}_{}.{}", stem, counter, ext));
            }

            std::fs::copy(source_path, &dest).map_err(|e| e.to_string())?;
            Ok(InstallResult {
                source,
                destination: dest.to_string_lossy().to_string(),
                status: InstallStatus::Success,
                message: Some(format!("Renamed to {}", dest.file_name().unwrap().to_string_lossy())),
            })
        }
        _ => Err(format!("Unknown strategy: {}", strategy)),
    }
}
