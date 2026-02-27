import { X, Coffee } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { open } from "@tauri-apps/plugin-shell";

export default function DonateModal() {
  const setShowDonate = useAppStore((s) => s.setShowDonate);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowDonate(false)} role="dialog" aria-modal="true" aria-label="Support SimShare">
      <div className="bg-bg-card rounded-2xl border border-border p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Support SimShare</h3>
          <button
            onClick={() => setShowDonate(false)}
            className="p-1 rounded-lg hover:bg-bg-card-hover transition-colors"
            aria-label="Close"
          >
            <X size={18} className="text-txt-dim" />
          </button>
        </div>
        <p className="text-sm text-txt-dim mb-5">
          SimShare is free and open-source. If you enjoy it, consider supporting development!
        </p>
        <div className="space-y-3">
          <button
            onClick={() => open("https://www.buymeacoffee.com/stixe").catch(() => {})}
            className="w-full flex items-center gap-3 bg-status-yellow/10 hover:bg-status-yellow/20 border border-status-yellow/30 rounded-xl px-4 py-3 transition-colors text-left"
          >
            <Coffee size={20} className="text-status-yellow" />
            <div>
              <p className="text-sm font-medium">Buy Me a Coffee</p>
              <p className="text-xs text-txt-dim">Support development</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
