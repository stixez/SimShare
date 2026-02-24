import { ArrowUpDown } from "lucide-react";
import type { SyncPlan } from "../lib/types";
import { formatBytes } from "../lib/utils";
import { useAppStore } from "../stores/useAppStore";

interface SyncBannerProps {
  plan: SyncPlan;
  onSync: () => void;
}

export default function SyncBanner({ plan, onSync }: SyncBannerProps) {
  const syncProgress = useAppStore((s) => s.syncProgress);

  const sendCount = plan.actions.filter((a) => a.SendToRemote).length;
  const receiveCount = plan.actions.filter((a) => a.ReceiveFromRemote).length;
  const conflictCount = plan.actions.filter((a) => a.Conflict).length;

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
            <span>{syncProgress.file}</span>
            <span>
              {syncProgress.files_done}/{syncProgress.files_total}
            </span>
          </div>
          <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{
                width: `${syncProgress.files_total > 0 ? (syncProgress.files_done / syncProgress.files_total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
