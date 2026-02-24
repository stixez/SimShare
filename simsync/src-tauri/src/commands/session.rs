use crate::network::discovery;
use crate::state::{AppState, PeerInfo, SessionInfo, SessionStatus, SessionType};
use crate::network::protocol::{self, Message};
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::Mutex;

#[tauri::command]
pub async fn start_host(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    app: tauri::AppHandle,
    name: String,
) -> Result<SessionInfo, String> {
    let mut app_state = state.lock().await;

    if app_state.session_type != SessionType::None {
        return Err("Already in a session. Disconnect first.".to_string());
    }

    if app_state.sims4_path.is_none() {
        return Err("Sims 4 path not set. Please set it first.".to_string());
    }

    let port = app_state.session_port;
    app_state.session_type = SessionType::Host;
    app_state.session_name = name.clone();
    app_state.local_display_name = name.clone();

    let mod_count = app_state.local_manifest.files.len();

    // Start mDNS broadcast in background
    let app_handle = app.clone();
    let host_name = name.clone();
    tokio::spawn(async move {
        if let Err(e) = discovery::start_broadcast(host_name, port, mod_count, app_handle).await {
            log::error!("mDNS broadcast error: {}", e);
        }
    });

    // Start TCP listener in background
    let app_handle = app.clone();
    let state_clone = state.inner().clone();
    tokio::spawn(async move {
        if let Err(e) = crate::network::transfer::start_listener(port, state_clone, app_handle).await {
            log::error!("TCP listener error: {}", e);
        }
    });

    Ok(SessionInfo {
        session_type: SessionType::Host,
        name,
        port,
        peer_count: 0,
    })
}

#[tauri::command]
pub async fn start_join(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    app: tauri::AppHandle,
    name: String,
) -> Result<Vec<PeerInfo>, String> {
    let app_state = state.lock().await;

    if app_state.session_type != SessionType::None {
        return Err("Already in a session. Disconnect first.".to_string());
    }

    drop(app_state);

    let peers = discovery::scan_for_hosts(app).await.map_err(|e| e.to_string())?;

    let mut app_state = state.lock().await;
    app_state.discovered_peers = peers.clone();
    // Store the user's chosen display name for use during connect
    app_state.local_display_name = name;

    Ok(peers)
}

#[tauri::command]
pub async fn connect_to_peer(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    app: tauri::AppHandle,
    peer_id: String,
) -> Result<SessionInfo, String> {
    let mut app_state = state.lock().await;

    let peer = app_state
        .discovered_peers
        .iter()
        .find(|p| p.id == peer_id)
        .cloned()
        .ok_or("Peer not found")?;

    app_state.session_type = SessionType::Client;
    app_state.session_name = peer.name.clone();

    let connection_peer_id = peer.id.clone();
    let state_clone = state.inner().clone();
    drop(app_state);

    // Connect to host in background
    let app_handle = app.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::network::transfer::connect_to_host(
            &peer.ip,
            peer.port,
            &connection_peer_id,
            state_clone.clone(),
            app_handle.clone(),
        ).await {
            log::error!("Connection error: {}", e);
            // Reset session state on failure
            let mut app_state = state_clone.lock().await;
            app_state.session_type = SessionType::None;
            app_state.session_name.clear();
            app_state.connections.clear();
            let _ = app_handle.emit(
                "connection-failed",
                serde_json::json!({"message": format!("{}", e)}),
            );
        }
    });

    Ok(SessionInfo {
        session_type: SessionType::Client,
        name: peer.name,
        port: peer.port,
        peer_count: 1,
    })
}

#[tauri::command]
pub async fn disconnect(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Send Disconnect message to all connected peers
    {
        let app_state = state.lock().await;
        for conn in app_state.connections.values() {
            let mut s = conn.stream.lock().await;
            let _ = protocol::send_message(&mut *s, &Message::Disconnect).await;
        }
    }

    crate::network::transfer::reset_cancellation_token().await;

    let mut app_state = state.lock().await;
    app_state.connections.clear();
    app_state.session_type = SessionType::None;
    app_state.session_name.clear();
    app_state.local_display_name.clear();
    app_state.discovered_peers.clear();

    discovery::stop_broadcast().await;

    let _ = app.emit("peer-disconnected", serde_json::json!({"name": "all"}));

    Ok(())
}

#[tauri::command]
pub async fn disconnect_peer(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
    app: tauri::AppHandle,
    peer_id: String,
) -> Result<(), String> {
    let mut app_state = state.lock().await;

    let conn = app_state
        .connections
        .remove(&peer_id)
        .ok_or_else(|| format!("Peer '{}' not found", peer_id))?;

    // Send Disconnect to the specific peer
    {
        let mut s = conn.stream.lock().await;
        let _ = protocol::send_message(&mut *s, &Message::Disconnect).await;
    }

    let _ = app.emit(
        "peer-disconnected",
        serde_json::json!({"name": conn.info.name, "peer_id": peer_id}),
    );

    Ok(())
}

#[tauri::command]
pub async fn get_session_status(
    state: tauri::State<'_, Arc<Mutex<AppState>>>,
) -> Result<SessionStatus, String> {
    let app_state = state.lock().await;
    Ok(SessionStatus {
        session_type: app_state.session_type.clone(),
        name: app_state.session_name.clone(),
        port: app_state.session_port,
        peers: app_state.peers(),
        is_syncing: app_state.is_any_syncing(),
    })
}
