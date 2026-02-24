import { Wifi, Globe } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

export default function ConnectionGuide() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wifi size={18} className="text-status-green" />
          <h3 className="font-semibold text-sm">Same Network</h3>
        </div>
        <p className="text-xs text-txt-dim leading-relaxed">
          If you and your friends are on the same Wi-Fi or LAN, SimSync will automatically discover
          each other. Just have one person host and others join — no setup needed.
        </p>
      </div>
      <div className="bg-bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={18} className="text-accent-light" />
          <h3 className="font-semibold text-sm">Different Location</h3>
        </div>
        <p className="text-xs text-txt-dim leading-relaxed">
          For remote friends, we recommend{" "}
          <button
            onClick={() => open("https://tailscale.com").catch(() => {})}
            className="text-accent-light hover:underline inline"
          >
            Tailscale
          </button>{" "}
          (free). It creates a virtual LAN between your devices so SimSync works as if you were on
          the same network.
        </p>
      </div>
    </div>
  );
}
