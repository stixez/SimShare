import { useRef, useEffect, useState, useMemo } from "react";
import { Trash2, History, ArrowUpDown } from "lucide-react";
import { useLogStore } from "../stores/useLogStore";
import { formatBytes } from "../lib/utils";
import { gameLabel } from "../lib/games";
import * as cmd from "../lib/commands";
import type { SyncHistoryEntry } from "../lib/types";

export default function ActivityLog() {
  const logs = useLogStore((s) => s.logs);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"log" | "history">("log");
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (tab === "history") {
      cmd.getSyncHistory().then(setHistory).catch(() => {});
    }
  }, [tab]);

  const levelColor = {
    info: "text-txt-dim",
    success: "text-status-green",
    warning: "text-status-yellow",
    error: "text-status-red",
  };

  const levelDot = {
    info: "bg-txt-dim",
    success: "bg-status-green",
    warning: "bg-status-yellow",
    error: "bg-status-red",
  };

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const directionLabel = (d: string) => {
    switch (d) {
      case "received": return "Received";
      case "sent": return "Sent";
      case "bidirectional": return "Synced";
      default: return "Synced";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Activity</h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setTab("log")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                tab === "log" ? "bg-accent text-white" : "bg-bg-card text-txt-dim hover:bg-bg-card-hover"
              }`}
            >
              Log
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                tab === "history" ? "bg-accent text-white" : "bg-bg-card text-txt-dim hover:bg-bg-card-hover"
              }`}
            >
              <History size={14} />
              Sync History
            </button>
          </div>
          {tab === "log" && (
            <button
              onClick={clearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover text-sm text-txt-dim transition-colors"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
          {tab === "history" && history.length > 0 && (
            <button
              onClick={() => {
                cmd.clearSyncHistory().then(() => setHistory([])).catch(() => {});
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover text-sm text-txt-dim transition-colors"
            >
              <Trash2 size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      {tab === "log" && (
        <div
          ref={scrollRef}
          className="bg-bg-card rounded-xl border border-border p-1 max-h-[calc(100vh-200px)] overflow-y-auto"
        >
          {logs.length === 0 ? (
            <p className="text-center text-txt-dim text-sm py-8">No activity yet</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 px-3 py-2 hover:bg-bg-card-hover rounded-lg"
              >
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${levelDot[log.level]}`} />
                <span className="text-xs text-txt-dim shrink-0 font-mono">{formatTime(log.timestamp)}</span>
                <span className={`text-sm ${levelColor[log.level]}`}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="bg-bg-card rounded-xl border border-border p-1 max-h-[calc(100vh-200px)] overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-center text-txt-dim text-sm py-8">No sync history yet</p>
          ) : (
            history.slice().reverse().map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 hover:bg-bg-card-hover rounded-lg"
              >
                <ArrowUpDown size={14} className="text-accent-light shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{directionLabel(entry.direction)} with {entry.peer_name}</span>
                    {entry.errors.length > 0 && (
                      <span className="text-xs text-status-red">{entry.errors.length} error(s)</span>
                    )}
                  </div>
                  <div className="text-xs text-txt-dim">
                    {gameLabel(entry.game)} &middot; {entry.files_synced} file{entry.files_synced !== 1 ? "s" : ""} &middot; {formatBytes(entry.total_bytes)}
                  </div>
                </div>
                <span className="text-xs text-txt-dim shrink-0">{formatDate(entry.timestamp)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
