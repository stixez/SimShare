import { create } from "zustand";
import type { LogEntry } from "../lib/types";

const STORAGE_KEY = "synccrate-logs";
const MAX_LOGS = 500;

interface LogState {
  logs: LogEntry[];
  addLog: (message: string, level: LogEntry["level"]) => void;
  clearLogs: () => void;
}

let nextId = 0;

function loadLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const logs = JSON.parse(raw) as LogEntry[];
      nextId = logs.length > 0 ? Math.max(...logs.map((l) => parseInt(l.id, 10) || 0)) + 1 : 0;
      return logs;
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function persistLogs(logs: LogEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

export const useLogStore = create<LogState>((set) => ({
  logs: loadLogs(),
  addLog: (message, level) =>
    set((state) => {
      const logs = [
        ...state.logs,
        {
          id: String(nextId++),
          timestamp: Date.now(),
          message,
          level,
        },
      ].slice(-MAX_LOGS);
      persistLogs(logs);
      return { logs };
    }),
  clearLogs: () => {
    persistLogs([]);
    return set({ logs: [] });
  },
}));
