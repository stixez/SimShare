import { invoke } from "@tauri-apps/api/core";
import type {
  FileManifest,
  ModProfile,
  PeerInfo,
  Resolution,
  SessionInfo,
  SessionStatus,
  SyncPlan,
} from "./types";

export async function startHost(name: string): Promise<SessionInfo> {
  return invoke("start_host", { name });
}

export async function startJoin(name: string): Promise<PeerInfo[]> {
  return invoke("start_join", { name });
}

export async function connectToPeer(peerId: string): Promise<SessionInfo> {
  return invoke("connect_to_peer", { peerId });
}

export async function disconnect(): Promise<void> {
  return invoke("disconnect");
}

export async function getSessionStatus(): Promise<SessionStatus> {
  return invoke("get_session_status");
}

export async function scanFiles(): Promise<FileManifest> {
  return invoke("scan_files");
}

export async function getSims4Path(): Promise<string> {
  return invoke("get_sims4_path");
}

export async function setSims4Path(path: string): Promise<void> {
  return invoke("set_sims4_path", { path });
}

export async function computeSyncPlan(): Promise<SyncPlan> {
  return invoke("compute_sync_plan");
}

export async function executeSync(): Promise<void> {
  return invoke("execute_sync");
}

export async function resolveConflict(
  path: string,
  resolution: Resolution,
): Promise<void> {
  return invoke("resolve_conflict", { path, resolution });
}

export async function listProfiles(): Promise<ModProfile[]> {
  return invoke("list_profiles");
}

export async function saveProfile(
  name: string,
  desc: string,
  icon: string,
): Promise<ModProfile> {
  return invoke("save_profile", { name, desc, icon });
}

export async function loadProfile(id: string): Promise<void> {
  return invoke("load_profile", { id });
}

export async function exportProfile(
  id: string,
  dest: string,
): Promise<void> {
  return invoke("export_profile", { id, dest });
}

export async function importProfile(path: string): Promise<ModProfile> {
  return invoke("import_profile", { path });
}

export async function deleteProfile(id: string): Promise<void> {
  return invoke("delete_profile", { id });
}
