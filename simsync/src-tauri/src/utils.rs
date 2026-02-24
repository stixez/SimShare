use std::path::PathBuf;

pub fn detect_sims4_path() -> Option<String> {
    let documents = dirs::document_dir()?;
    let sims4_path = documents.join("Electronic Arts").join("The Sims 4");
    if sims4_path.exists() {
        Some(sims4_path.to_string_lossy().to_string())
    } else {
        None
    }
}

pub fn mods_path(base: &str) -> PathBuf {
    PathBuf::from(base).join("Mods")
}

pub fn saves_path(base: &str) -> PathBuf {
    PathBuf::from(base).join("Saves")
}

pub fn profiles_dir() -> PathBuf {
    let config = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let dir = config.join("simsync").join("profiles");
    std::fs::create_dir_all(&dir).ok();
    dir
}

pub fn timestamp_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Validate that a relative path does not escape the base directory.
/// Rejects absolute paths, ".." components, and returns the canonical joined path.
pub fn safe_join(base: &str, relative: &str) -> Result<PathBuf, String> {
    // Reject absolute paths
    let rel = std::path::Path::new(relative);
    if rel.is_absolute() {
        return Err(format!("Absolute path rejected: {}", relative));
    }

    // Reject paths containing ".." components
    for component in rel.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err(format!("Path traversal rejected: {}", relative));
        }
    }

    let joined = PathBuf::from(base).join(relative);

    // Final safety check: canonicalize and verify containment.
    // If the file doesn't exist yet (write case), check parent directory.
    let base_canonical = std::fs::canonicalize(base)
        .map_err(|e| format!("Cannot resolve base path: {}", e))?;

    if joined.exists() {
        let joined_canonical = std::fs::canonicalize(&joined)
            .map_err(|e| format!("Cannot resolve path: {}", e))?;
        if !joined_canonical.starts_with(&base_canonical) {
            return Err(format!("Path escapes base directory: {}", relative));
        }
    } else if let Some(parent) = joined.parent() {
        // For new files, ensure the parent directory (if it exists) is within base
        if parent.exists() {
            let parent_canonical = std::fs::canonicalize(parent)
                .map_err(|e| format!("Cannot resolve parent path: {}", e))?;
            if !parent_canonical.starts_with(&base_canonical) {
                return Err(format!("Path escapes base directory: {}", relative));
            }
        }
    }

    Ok(joined)
}

/// Validate a profile ID contains no path separators or traversal
pub fn sanitize_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("ID cannot be empty".to_string());
    }
    if id.contains('/') || id.contains('\\') || id.contains("..") || id.contains('\0') {
        return Err("Invalid ID: contains path separators or traversal".to_string());
    }
    Ok(())
}
