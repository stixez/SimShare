use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;
use tauri::Emitter;

/// Start watching a dynamic list of content type directories.
pub fn start_watching(
    paths: &[String],
    app: tauri::AppHandle,
) -> Result<RecommendedWatcher, String> {
    let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();

    let mut watcher = RecommendedWatcher::new(tx, Config::default().with_poll_interval(Duration::from_secs(2)))
        .map_err(|e| e.to_string())?;

    for path_str in paths {
        let p = Path::new(path_str);
        if p.exists() {
            watcher
                .watch(p, RecursiveMode::Recursive)
                .map_err(|e| e.to_string())?;
        }
    }

    // Spawn a thread to process FS events with debouncing
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut last_emit = std::time::Instant::now();
        let debounce = Duration::from_millis(500);

        loop {
            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(Ok(event)) => {
                    if last_emit.elapsed() >= debounce {
                        let paths: Vec<String> = event
                            .paths
                            .iter()
                            .map(|p| p.to_string_lossy().to_string())
                            .collect();

                        let _ = app_handle.emit(
                            "files-changed",
                            serde_json::json!({
                                "paths": paths,
                                "kind": format!("{:?}", event.kind),
                            }),
                        );
                        last_emit = std::time::Instant::now();
                    }
                }
                Ok(Err(e)) => {
                    log::error!("Watch error: {}", e);
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(watcher)
}
