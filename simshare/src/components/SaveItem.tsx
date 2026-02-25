import { Save } from "lucide-react";
import type { FileInfo } from "../lib/types";
import { formatBytes, formatDate } from "../lib/utils";
import StatusBadge from "./StatusBadge";

interface SaveItemProps {
  file: FileInfo;
  syncStatus?: "synced" | "pending" | "conflict" | "local";
}

export default function SaveItem({ file, syncStatus = "local" }: SaveItemProps) {
  const name = file.relative_path.split(/[/\\]/).pop() || file.relative_path;

  return (
    <div className="flex items-center gap-3 bg-bg-card rounded-lg border border-border px-4 py-3 hover:bg-bg-card-hover transition-colors">
      <div className="w-8 h-8 rounded-lg bg-status-green/20 flex items-center justify-center">
        <Save size={16} className="text-status-green" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-txt-dim">{formatDate(file.modified)}</p>
      </div>
      <span className="text-xs text-txt-dim">{formatBytes(file.size)}</span>
      <StatusBadge status={syncStatus} />
    </div>
  );
}
