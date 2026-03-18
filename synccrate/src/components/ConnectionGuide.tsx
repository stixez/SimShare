import { Wifi, Globe, AlertTriangle } from "lucide-react";
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
          If you and your friends are on the same Wi-Fi or LAN, SyncCrate will automatically discover
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
          (free). It creates a virtual LAN between your devices.
        </p>
        <div className="mt-2 flex items-start gap-1.5 bg-status-yellow/5 rounded-lg p-2">
          <AlertTriangle size={12} className="text-status-yellow shrink-0 mt-0.5" />
          <p className="text-[11px] text-status-yellow/80 leading-relaxed">
            Auto-discovery doesn't work over VPN. Use <span className="font-medium">Connect by IP</span> instead
            — the host's VPN IP is shown in the Tailscale/ZeroTier app.
          </p>
        </div>
      </div>
    </div>
  );
}
