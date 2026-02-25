import { useState, useEffect, useCallback } from "react";
import { Monitor, Users, Package, Save, HardDrive, RefreshCw, AlertTriangle } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useLogStore } from "../stores/useLogStore";
import { useSession } from "../hooks/useSession";
import { useSync } from "../hooks/useSync";
import { formatBytes } from "../lib/utils";
import * as cmd from "../lib/commands";
import SyncBanner from "./SyncBanner";
import PeerList from "./PeerList";
import ConnectionGuide from "./ConnectionGuide";

export default function Dashboard() {
  const session = useAppStore((s) => s.session);
  const manifest = useAppStore((s) => s.manifest);
  const setManifest = useAppStore((s) => s.setManifest);
  const syncPlan = useAppStore((s) => s.syncPlan);
  const isScanning = useAppStore((s) => s.isScanning);
  const setIsScanning = useAppStore((s) => s.setIsScanning);
  const discoveredPeers = useAppStore((s) => s.discoveredPeers);
  const addLog = useLogStore((s) => s.addLog);
  const { host, join, connectTo, leave, isLoading } = useSession();
  const { computePlan, executeSync, isLoading: isSyncLoading } = useSync();
  const [hostName, setHostName] = useState("");

  const [localVersion, setLocalVersion] = useState("");
  useEffect(() => {
    cmd.getAppVersion().then(setLocalVersion).catch(() => {});
  }, []);

  const isConnected = session && session.session_type !== "None";
  const mismatchedPeers = isConnected && localVersion
    ? session.peers.filter((p) => p.version && p.version !== localVersion)
    : [];

  const modCount = manifest
    ? Object.values(manifest.files).filter((f) => f.file_type === "Mod").length
    : 0;
  const ccCount = manifest
    ? Object.values(manifest.files).filter((f) => f.file_type === "CustomContent").length
    : 0;
  const saveCount = manifest
    ? Object.values(manifest.files).filter((f) => f.file_type === "Save").length
    : 0;
  const totalSize = manifest
    ? Object.values(manifest.files).reduce((sum, f) => sum + f.size, 0)
    : 0;

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    try {
      const m = await cmd.scanFiles();
      setManifest(m);
    } catch (e) {
      addLog(`Scan failed: ${e}`, "error");
    } finally {
      setIsScanning(false);
    }
  }, [setIsScanning, setManifest, addLog]);

  useEffect(() => {
    if (!manifest) {
      handleScan();
    }
  }, [manifest, handleScan]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome to SimShare</h2>
          <p className="text-txt-dim">Sync your Sims 4 mods and saves with friends over LAN</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Monitor size={20} className="text-accent-light" />
              </div>
              <h3 className="font-semibold">Host a Session</h3>
            </div>
            <p className="text-txt-dim text-sm mb-4">
              Share your mods and saves with others on your network.
            </p>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value.replace(/[^\w\s-]/g, "").slice(0, 32))}
              maxLength={32}
              placeholder="Your name..."
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-accent"
            />
            <button
              onClick={() => host(hostName.trim() || "Host")}
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent-light text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? "Starting..." : "Start Hosting"}
            </button>
          </div>

          <div className="bg-bg-card rounded-xl border border-border p-6 hover:border-accent/50 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-status-green/20 flex items-center justify-center">
                <Users size={20} className="text-status-green" />
              </div>
              <h3 className="font-semibold">Join a Session</h3>
            </div>
            <p className="text-txt-dim text-sm mb-4">
              Connect to a host on your network and sync files.
            </p>
            <button
              onClick={() => join(hostName.trim() || "Guest")}
              disabled={isLoading}
              className="w-full bg-status-green/20 hover:bg-status-green/30 text-status-green rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 mb-3"
            >
              {isLoading ? "Scanning..." : "Scan for Hosts"}
            </button>
            {discoveredPeers.length > 0 && (
              <div className="space-y-2">
                {discoveredPeers.map((peer) => (
                  <button
                    key={peer.id}
                    onClick={() => connectTo(peer.id)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between bg-bg rounded-lg px-3 py-2 text-sm hover:bg-bg-card-hover transition-colors disabled:opacity-50"
                  >
                    <span>{peer.name}</span>
                    <span className="text-txt-dim text-xs">{peer.mod_count} mods</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {manifest && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Script Mods", value: modCount, icon: Package, color: "text-accent-light" },
              { label: "Custom Content", value: ccCount, icon: Package, color: "text-pink-400" },
              { label: "Save Files", value: saveCount, icon: Save, color: "text-status-green" },
              { label: "Total Size", value: formatBytes(totalSize), icon: HardDrive, color: "text-status-yellow" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className={color} />
                  <span className="text-txt-dim text-sm">{label}</span>
                </div>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
            {isScanning ? "Scanning..." : "Scan Files"}
          </button>
        </div>

        <ConnectionGuide />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dashboard</h2>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
            Scan Files
          </button>
          <button
            onClick={computePlan}
            disabled={isSyncLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white text-sm transition-colors disabled:opacity-50"
          >
            {isSyncLoading ? "Computing..." : "Compare & Sync"}
          </button>
          <button
            onClick={leave}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-status-red/20 hover:bg-status-red/30 text-status-red text-sm transition-colors disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>

      {mismatchedPeers.length > 0 && (
        <div className="bg-status-yellow/10 border border-status-yellow/30 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-status-yellow shrink-0" />
          <span className="text-sm text-status-yellow">
            Version mismatch: {mismatchedPeers.map((p) => `${p.name} (v${p.version})`).join(", ")} — you have v{localVersion}. Update both to the same version for best results.
          </span>
        </div>
      )}

      {syncPlan && syncPlan.actions.length > 0 && (
        <SyncBanner plan={syncPlan} onSync={executeSync} />
      )}
      {syncPlan && syncPlan.actions.length === 0 && (
        <div className="bg-status-green/10 border border-status-green/30 rounded-xl p-4 text-center">
          <span className="text-sm text-status-green font-medium">Everything is in sync!</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Script Mods", value: modCount, icon: Package, color: "text-accent-light" },
          { label: "Custom Content", value: ccCount, icon: Package, color: "text-pink-400" },
          { label: "Save Files", value: saveCount, icon: Save, color: "text-status-green" },
          { label: "Total Size", value: formatBytes(totalSize), icon: HardDrive, color: "text-status-yellow" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={color} />
              <span className="text-txt-dim text-sm">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <PeerList />
    </div>
  );
}
