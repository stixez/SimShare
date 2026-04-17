use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Top-level registry file structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRegistry {
    pub version: u32,
    pub games: Vec<GameDefinition>,
}

/// Complete definition of a supported game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDefinition {
    pub id: String,
    pub label: String,
    pub family: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub color: String,
    /// Hex color for dynamic accent theming (e.g., "#1ea84b").
    #[serde(default)]
    pub primary_color: String,
    #[serde(default)]
    pub auto_detect: bool,
    #[serde(default)]
    pub detection: Option<DetectionConfig>,
    #[serde(default)]
    pub validation: Option<ValidationConfig>,
    pub content_types: Vec<ContentType>,
    #[serde(default)]
    pub dangerous_script_extensions: Vec<String>,
    /// Key into the hardcoded pack registry (e.g., "sims4", "sims3", "sims2").
    #[serde(default)]
    pub packs: Option<String>,
    /// Old Game enum variant name for migration from pre-registry config.
    #[serde(default)]
    pub legacy_id: Option<String>,
    #[serde(default)]
    pub version_detection: Option<VersionDetection>,
    #[serde(default)]
    pub path_correction: Option<PathCorrection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionConfig {
    #[serde(default)]
    pub strategies: Vec<DetectionStrategy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum DetectionStrategy {
    /// Check paths relative to the user's Documents directory.
    #[serde(rename = "documents_relative")]
    DocumentsRelative {
        base: String,
        folders: Vec<String>,
    },
    /// Check absolute paths, per-platform.
    #[serde(rename = "absolute_paths")]
    AbsolutePaths {
        #[serde(default)]
        paths: PlatformPaths,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlatformPaths {
    #[serde(default)]
    pub windows: Vec<String>,
    #[serde(default)]
    pub macos: Vec<String>,
    #[serde(default)]
    pub linux: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationConfig {
    /// At least one of these directories must exist for the path to be valid.
    #[serde(default)]
    pub check_dirs: Vec<String>,
    /// Directories to create automatically on set_game_path.
    #[serde(default)]
    pub auto_create_dirs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentType {
    pub id: String,
    pub label: String,
    pub folder: String,
    #[serde(default)]
    pub extensions: Vec<String>,
    /// Default file_type string for files in this folder.
    pub file_type: String,
    /// Map specific extensions to different file_type values within this folder.
    #[serde(default)]
    pub classify_by_extension: HashMap<String, String>,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub color: String,
    #[serde(default = "default_true")]
    pub syncable: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionDetection {
    pub file: String,
    #[serde(default = "default_read_text")]
    pub method: String,
}

fn default_read_text() -> String {
    "read_text_file".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathCorrection {
    #[serde(default)]
    pub known_subfolders: Vec<String>,
    #[serde(default)]
    pub nested_corrections: HashMap<String, u32>,
}

/// Load the game registry from the embedded JSON.
pub fn load_registry() -> GameRegistry {
    let json = include_str!("game_registry.json");
    serde_json::from_str(json).expect("Invalid embedded game_registry.json")
}

/// Build a lookup map from game ID to definition.
pub fn build_registry_map(registry: &GameRegistry) -> HashMap<String, GameDefinition> {
    registry.games.iter().map(|g| (g.id.clone(), g.clone())).collect()
}

/// Build a lookup map from legacy ID to new game ID for migration.
pub fn build_legacy_map(registry: &GameRegistry) -> HashMap<String, String> {
    registry.games.iter()
        .filter_map(|g| g.legacy_id.as_ref().map(|lid| (lid.clone(), g.id.clone())))
        .collect()
}

/// Resolve a game ID, accepting both new IDs and legacy enum variant names.
pub fn resolve_game_id(
    id: &str,
    registry_map: &HashMap<String, GameDefinition>,
    legacy_map: &HashMap<String, String>,
) -> Option<String> {
    if registry_map.contains_key(id) {
        return Some(id.to_string());
    }
    legacy_map.get(id).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_includes_recent_game_additions() {
        let registry = load_registry();
        let ids: Vec<_> = registry.games.iter().map(|g| g.id.as_str()).collect();

        assert!(ids.contains(&"project_zomboid"));
        assert!(ids.contains(&"skyrim_se"));
        assert!(ids.contains(&"bannerlord"));
    }
}
