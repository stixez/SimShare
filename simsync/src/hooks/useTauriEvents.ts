import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useAppStore } from "../stores/useAppStore";
import { useLogStore } from "../stores/useLogStore";
import * as cmd from "../lib/commands";

export function useTauriEvents() {
  const setSyncProgress = useAppStore((s) => s.setSyncProgress);
  const setSyncPlan = useAppStore((s) => s.setSyncPlan);
  const setSession = useAppStore((s) => s.setSession);
  const addLog = useLogStore((s) => s.addLog);

  useEffect(() => {
    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];

    async function setup() {
      const listeners: Promise<UnlistenFn>[] = [
        listen<{ paths: string[]; kind: string }>("files-changed", (event) => {
          addLog(`Files changed: ${event.payload.kind}`, "info");
        }),
        listen<{ name: string }>("peer-connected", async (event) => {
          addLog(`Peer connected: ${event.payload.name}`, "success");
          // Refresh session status to update peer list
          try {
            const status = await cmd.getSessionStatus();
            setSession(status);
          } catch {
            // Ignore if session status fetch fails
          }
        }),
        listen<{ name: string }>("peer-disconnected", async (event) => {
          addLog(`Peer disconnected: ${event.payload.name}`, "warning");
          // Refresh session status to update peer list
          try {
            const status = await cmd.getSessionStatus();
            setSession(status);
          } catch {
            // Ignore if session status fetch fails
          }
        }),
        listen<{ message: string }>("connection-failed", (event) => {
          addLog(`Connection failed: ${event.payload.message}`, "error");
          setSession(null);
        }),
        listen<{ file: string; bytes_sent: number; bytes_total: number; files_done: number; files_total: number }>(
          "sync-progress",
          (event) => {
            setSyncProgress(event.payload);
          },
        ),
        listen<{ files_synced: number; total_bytes: number; errors: string[] }>("sync-complete", (event) => {
          setSyncProgress(null);
          setSyncPlan(null);
          const { files_synced, errors } = event.payload;
          if (errors && errors.length > 0) {
            addLog(
              `Sync completed with ${errors.length} error(s): ${files_synced} files synced`,
              "warning",
            );
            for (const err of errors) {
              addLog(`  Sync error: ${err}`, "error");
            }
          } else {
            addLog(`Sync complete: ${files_synced} files synced`, "success");
          }
        }),
        listen<{ message: string }>("sync-error", (event) => {
          addLog(`Sync error: ${event.payload.message}`, "error");
        }),
      ];

      const results = await Promise.all(listeners);
      if (!cancelled) {
        unlisteners.push(...results);
      } else {
        // Component unmounted before setup finished — clean up immediately
        results.forEach((fn) => fn());
      }
    }

    setup();

    return () => {
      cancelled = true;
      unlisteners.forEach((fn) => fn());
    };
  }, [setSyncProgress, setSyncPlan, setSession, addLog]);
}
