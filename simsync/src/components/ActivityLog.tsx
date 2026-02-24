import { useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useLogStore } from "../stores/useLogStore";

export default function ActivityLog() {
  const logs = useLogStore((s) => s.logs);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Activity Log</h2>
        <button
          onClick={clearLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-bg-card-hover text-sm text-txt-dim transition-colors"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

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
    </div>
  );
}
