import { useEffect } from "react";
import { useAppStore } from "../stores/useAppStore";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + Shift + S → Settings
      if (mod && e.shiftKey && e.key === "S") {
        e.preventDefault();
        useAppStore.getState().setPage("settings");
        return;
      }

      // Ctrl/Cmd + Shift + F → Mods page + focus search
      if (mod && e.shiftKey && e.key === "F") {
        e.preventDefault();
        useAppStore.getState().setPage("mods");
        // Focus search on next tick after page renders
        requestAnimationFrame(() => {
          const searchInput = document.querySelector<HTMLInputElement>('input[aria-label="Search mods"]');
          searchInput?.focus();
        });
        return;
      }

      // "/" → focus search on current page (only if not in an input)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[aria-label="Search mods"], input[aria-label="Search saves"]'
        );
        searchInput?.focus();
        return;
      }

      // Escape → close modals
      if (e.key === "Escape" && !isInput) {
        useAppStore.getState().setShowDonate(false);
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
