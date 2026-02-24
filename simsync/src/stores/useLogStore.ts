import { create } from "zustand";
import type { LogEntry } from "../lib/types";

interface LogState {
  logs: LogEntry[];
  addLog: (message: string, level: LogEntry["level"]) => void;
  clearLogs: () => void;
}

let nextId = 0;

export const useLogStore = create<LogState>((set) => ({
  logs: [],
  addLog: (message, level) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          id: String(nextId++),
          timestamp: Date.now(),
          message,
          level,
        },
      ].slice(-500),
    })),
  clearLogs: () => set({ logs: [] }),
}));
