use notify::RecommendedWatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::Mutex as TokioMutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub relative_path: String,
    pub size: u64,
    pub hash: String,
    pub modified: u64,
    pub file_type: FileType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum FileType {
    Mod,
    CustomContent,
    Save,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FileManifest {
    pub files: HashMap<String, FileInfo>,
    pub generated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub port: u16,
    pub mod_count: usize,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_type: SessionType,
    pub name: String,
    pub port: u16,
    pub peer_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SessionType {
    Host,
    Client,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStatus {
    pub session_type: SessionType,
    pub name: String,
    pub port: u16,
    pub peers: Vec<PeerInfo>,
    pub is_syncing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncAction {
    SendToRemote(FileInfo),
    ReceiveFromRemote(FileInfo),
    Conflict {
        local: FileInfo,
        remote: FileInfo,
    },
    Delete(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPlan {
    pub actions: Vec<SyncAction>,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Resolution {
    KeepMine,
    UseTheirs,
    KeepBoth,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModProfile {
    pub id: String,
    pub name: String,
    pub description: String,
    pub icon: String,
    pub author: String,
    pub created_at: u64,
    pub mods: Vec<ProfileMod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileMod {
    pub relative_path: String,
    pub hash: String,
    pub size: u64,
    pub name: String,
}

pub struct AppState {
    pub sims4_path: Option<String>,
    pub local_manifest: FileManifest,
    pub remote_manifest: Option<FileManifest>,
    pub session_type: SessionType,
    pub session_name: String,
    pub local_display_name: String,
    pub session_port: u16,
    pub peers: Vec<PeerInfo>,
    pub is_syncing: bool,
    pub discovered_peers: Vec<PeerInfo>,
    pub sync_plan: Option<SyncPlan>,
    pub connection: Option<Arc<TokioMutex<TcpStream>>>,
    #[allow(dead_code)]
    pub file_watcher: Option<RecommendedWatcher>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            sims4_path: None,
            local_manifest: FileManifest::default(),
            remote_manifest: None,
            session_type: SessionType::None,
            session_name: String::new(),
            local_display_name: String::new(),
            session_port: 9847,
            peers: Vec::new(),
            is_syncing: false,
            discovered_peers: Vec::new(),
            sync_plan: None,
            connection: None,
            file_watcher: None,
        }
    }
}
