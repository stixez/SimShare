import { Users, Monitor, X } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import * as cmd from "../lib/commands";
import { useLogStore } from "../stores/useLogStore";

export default function PeerList() {
  const session = useAppStore((s) => s.session);
  const addLog = useLogStore((s) => s.addLog);

  const isHost = session?.session_type === "Host";

  const handleKick = async (peerId: string, peerName: string) => {
    try {
      await cmd.disconnectPeer(peerId);
      addLog(`Kicked peer: ${peerName}`, "info");
    } catch (e) {
      addLog(`Failed to kick peer: ${e}`, "error");
    }
  };

  if (!session || session.peers.length === 0) {
    return (
      <div className="bg-bg-card rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-txt-dim" />
          <h3 className="font-semibold text-sm">Connected Peers</h3>
        </div>
        <p className="text-xs text-txt-dim">No peers connected yet</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-status-green" />
        <h3 className="font-semibold text-sm">Connected Peers</h3>
      </div>
      <div className="space-y-2">
        {session.peers.map((peer) => (
          <div key={peer.id} className="flex items-center gap-3 bg-bg rounded-lg px-3 py-2">
            <Monitor size={14} className="text-accent-light" />
            <div className="flex-1">
              <p className="text-sm font-medium">{peer.name}</p>
              <p className="text-xs text-txt-dim">{peer.ip}:{peer.port}</p>
            </div>
            <span className="text-xs text-txt-dim">{peer.mod_count} mods</span>
            <span className="w-2 h-2 rounded-full bg-status-green" />
            {isHost && (
              <button
                onClick={() => handleKick(peer.id, peer.name)}
                title="Kick peer"
                className="ml-1 p-1 rounded hover:bg-status-red/20 text-txt-dim hover:text-status-red transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
