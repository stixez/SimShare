import { useRef, useEffect } from "react";
import { ArrowUpDown } from "lucide-react";
import type { SyncPlan } from "../lib/types";
import { formatBytes } from "../lib/utils";
import { useAppStore } from "../stores/useAppStore";

interface SyncBannerProps {
  plan: SyncPlan;
  onSync: () => void;
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "--";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `${m}m ${s}s`;
}

export default function SyncBanner({ plan, onSync }: SyncBannerProps) {
  const syncProgress = useAppStore((s) => s.syncProgress);
  const startTimeRef = useRef<number | null>(null);
  const startBytesRef = useRef<number>(0);

  useEffect(() => {
    if (syncProgress && startTimeRef.current === null) {
      startTimeRef.current = Date.now();
      startBytesRef.current = syncProgress.bytes_sent;
    }
    if (!syncProgress) {
      startTimeRef.current = null;
      startBytesRef.current = 0;
    }
  }, [syncProgress]);

  const sendCount = plan.actions.filter((a) => a.SendToRemote).length;
  const receiveCount = plan.actions.filter((a) => a.ReceiveFromRemote).length;
  const conflictCount = plan.actions.filter((a) => a.Conflict).length;

  let speedText = "";
  let etaText = "";
  if (syncProgress && startTimeRef.current) {
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const bytesDelta = syncProgress.bytes_sent - startBytesRef.current;
    if (elapsed > 1) {
      const speed = bytesDelta / elapsed;
      speedText = `${formatBytes(speed)}/s`;
      const remaining = syncProgress.bytes_total - syncProgress.bytes_sent;
      if (speed > 0) {
        etaText = formatEta(remaining / speed);
      }
    }
  }

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ArrowUpDown size={16} className="text-accent-light" />
          <span className="font-medium text-sm">Sync Plan Ready</span>
        </div>
        <button
          onClick={onSync}
          disabled={!!syncProgress || conflictCount > 0}
          className="bg-accent hover:bg-accent-light text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {syncProgress ? "Syncing..." : conflictCount > 0 ? "Resolve Conflicts First" : "Sync Now"}
        </button>
      </div>
      <div className="flex gap-4 text-xs text-txt-dim">
        {sendCount > 0 && <span>Upload: {sendCount} files</span>}
        {receiveCount > 0 && <span>Download: {receiveCount} files</span>}
        {conflictCount > 0 && <span className="text-status-red">Conflicts: {conflictCount}</span>}
        <span>Total: {formatBytes(plan.total_bytes)}</span>
      </div>
      {syncProgress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-txt-dim mb-1">
            <span className="truncate mr-3">{syncProgress.file}</span>
            <span className="shrink-0">
              {syncProgress.files_done}/{syncProgress.files_total} files
              {" · "}
              {formatBytes(syncProgress.bytes_sent)} / {formatBytes(syncProgress.bytes_total)}
              {" · "}
              {syncProgress.bytes_total > 0
                ? Math.round((syncProgress.bytes_sent / syncProgress.bytes_total) * 100)
                : 0}%
              {speedText && ` · ${speedText}`}
              {etaText && ` · ETA ${etaText}`}
            </span>
          </div>
          <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{
                width: `${syncProgress.bytes_total > 0 ? (syncProgress.bytes_sent / syncProgress.bytes_total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
