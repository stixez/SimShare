import { Puzzle, Palette } from "lucide-react";
import type { FileInfo } from "../lib/types";
import { formatBytes } from "../lib/utils";
import StatusBadge from "./StatusBadge";

interface ModItemProps {
  file: FileInfo;
  syncStatus?: "synced" | "pending" | "conflict" | "local";
}

export default function ModItem({ file, syncStatus = "local" }: ModItemProps) {
  const isMod = file.file_type === "Mod";
  const name = file.relative_path.split(/[/\\]/).pop() || file.relative_path;

  return (
    <div className="flex items-center gap-3 bg-bg-card rounded-lg border border-border px-4 py-3 hover:bg-bg-card-hover transition-colors">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isMod ? "bg-accent/20" : "bg-pink-500/20"}`}>
        {isMod ? <Puzzle size={16} className="text-accent-light" /> : <Palette size={16} className="text-pink-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-txt-dim truncate">{file.relative_path}</p>
      </div>
      <span className="text-xs text-txt-dim">{formatBytes(file.size)}</span>
      <span className="text-xs text-txt-dim font-mono">{file.hash.slice(0, 8)}</span>
      <StatusBadge status={syncStatus} />
    </div>
  );
}
