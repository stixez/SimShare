import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Package } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import ModItem from "./ModItem";
import ConflictResolver from "./ConflictResolver";
import { useSync } from "../hooks/useSync";
import * as cmd from "../lib/commands";

export default function ModList() {
  const manifest = useAppStore((s) => s.manifest);
  const setManifest = useAppStore((s) => s.setManifest);
  const syncPlan = useAppStore((s) => s.syncPlan);
  const { resolve } = useSync();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mod" | "cc">("all");

  useEffect(() => {
    if (!manifest) {
      cmd.scanFiles().then(setManifest).catch(console.error);
    }
  }, [manifest, setManifest]);

  const getSyncStatus = useCallback(
    (path: string): "synced" | "pending" | "conflict" | "local" => {
      if (!syncPlan) return "local";
      for (const action of syncPlan.actions) {
        if (action.Conflict && (action.Conflict.local.relative_path === path || action.Conflict.remote.relative_path === path)) {
          return "conflict";
        }
        if (action.SendToRemote && action.SendToRemote.relative_path === path) return "pending";
        if (action.ReceiveFromRemote && action.ReceiveFromRemote.relative_path === path) return "pending";
      }
      return "synced";
    },
    [syncPlan],
  );

  const conflicts = useMemo(() => {
    if (!syncPlan) return [];
    return syncPlan.actions
      .filter((a) => a.Conflict)
      .map((a) => a.Conflict!)
      .filter(
        (c) =>
          c.local.file_type === "Mod" || c.local.file_type === "CustomContent",
      );
  }, [syncPlan]);

  const mods = useMemo(() => {
    if (!manifest) return [];
    return Object.values(manifest.files)
      .filter((f) => f.file_type === "Mod" || f.file_type === "CustomContent")
      .filter((f) => {
        if (filter === "mod") return f.file_type === "Mod";
        if (filter === "cc") return f.file_type === "CustomContent";
        return true;
      })
      .filter((f) =>
        f.relative_path.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  }, [manifest, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mods & Custom Content</h2>
        <span className="text-txt-dim text-sm">{mods.length} items</span>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mods..."
            className="w-full bg-bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["all", "mod", "cc"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filter === f ? "bg-accent text-white" : "bg-bg-card text-txt-dim hover:bg-bg-card-hover"
              }`}
            >
              {f === "all" ? "All" : f === "mod" ? "Scripts" : "CC"}
            </button>
          ))}
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-3">
          {conflicts.map((c) => (
            <ConflictResolver
              key={c.local.relative_path}
              localFile={c.local}
              remoteFile={c.remote}
              onResolve={(resolution) => resolve(c.local.relative_path, resolution)}
            />
          ))}
        </div>
      )}

      <div className="space-y-1">
        {mods.length === 0 ? (
          <div className="text-center py-12 text-txt-dim">
            <Package size={40} className="mx-auto mb-3 opacity-40" />
            <p>No mods found</p>
            <p className="text-xs mt-1">Make sure your Sims 4 Mods folder path is correct</p>
          </div>
        ) : (
          mods.map((mod) => (
            <ModItem
              key={mod.relative_path}
              file={mod}
              syncStatus={getSyncStatus(mod.relative_path)}
            />
          ))
        )}
      </div>
    </div>
  );
}
