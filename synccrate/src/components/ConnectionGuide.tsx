import { Wifi, Globe, AlertTriangle, Shield, Terminal } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

export default function ConnectionGuide() {
  return (
    <div className="space-y-4">
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
            <h3 className="font-semibold text-sm">Different Location (VPN)</h3>
          </div>
          <p className="text-xs text-txt-dim leading-relaxed">
            For remote friends, use{" "}
            <button
              onClick={() => open("https://tailscale.com").catch(() => {})}
              className="text-accent-light hover:underline inline"
            >
              Tailscale
            </button>{" "}
            or{" "}
            <button
              onClick={() => open("https://www.zerotier.com").catch(() => {})}
              className="text-accent-light hover:underline inline"
            >
              ZeroTier
            </button>{" "}
            (both free). They create a virtual LAN between your devices.
          </p>
          <div className="mt-2 flex items-start gap-1.5 bg-status-yellow/5 rounded-lg p-2">
            <AlertTriangle size={12} className="text-status-yellow shrink-0 mt-0.5" />
            <p className="text-[11px] text-status-yellow/80 leading-relaxed">
              Auto-discovery won't work over VPN. Use <span className="font-medium">Connect by IP</span> instead
              — find the host's VPN IP in the Tailscale/ZeroTier app (starts with 100.x.x.x for Tailscale).
            </p>
          </div>
        </div>
      </div>
      <div className="bg-status-red/5 rounded-xl border border-status-red/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-status-red shrink-0" />
          <h4 className="text-xs font-semibold text-status-red">Firewall Setup (Required for Host)</h4>
        </div>
        <p className="text-[11px] text-txt-dim leading-relaxed mb-2">
          The <span className="font-medium text-txt">host</span> must allow SyncCrate through Windows Firewall.
          This is the #1 cause of "connection failed" errors, especially over Tailscale/ZeroTier.
        </p>
        <div className="space-y-1.5 mb-3">
          <p className="text-[11px] text-txt-dim leading-relaxed">
            <span className="font-medium text-txt">Option 1:</span> Windows Settings &rarr; Privacy &amp; Security &rarr; Windows Security &rarr;
            Firewall &rarr; Allow an app through firewall &rarr; find SyncCrate &rarr; check <span className="font-medium text-txt">both Private and Public</span>.
          </p>
          <p className="text-[11px] text-txt-dim leading-relaxed">
            <span className="font-medium text-txt">Option 2:</span> Run this command as Administrator in PowerShell:
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-txt-muted" />
          <code className="text-[10px] bg-bg-elevated px-2 py-1 rounded font-mono text-accent-light select-all">
            netsh advfirewall firewall add rule name="SyncCrate" dir=in action=allow protocol=TCP localport=9847
          </code>
        </div>
      </div>
      <div className="bg-bg-card rounded-xl border border-border p-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-status-yellow shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-semibold mb-1">Still not connecting?</h4>
          <ul className="text-[11px] text-txt-dim leading-relaxed space-y-1 list-disc list-inside">
            <li>Make sure both players are running the <span className="font-medium text-txt">same version</span> of SyncCrate</li>
            <li>Verify the host is actively hosting (green "Hosting" status)</li>
            <li>Test connectivity: open a terminal and run <code className="bg-bg-elevated px-1 rounded font-mono text-[10px]">ping [host-IP]</code></li>
            <li>If using a custom port, make sure both sides use the same port number</li>
            <li>Tailscale/ZeroTier: check that both devices show as "Connected" in the VPN app</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
