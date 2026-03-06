import { useState, useMemo } from "react";
import { Search, Plus, Check } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { useLogStore } from "../stores/useLogStore";
import { GameIcon } from "./Sidebar";
import * as cmd from "../lib/commands";
import { toastSuccess } from "../lib/toast";

export default function GameBrowser() {
  const gameRegistry = useAppStore((s) => s.gameRegistry);
  const myLibrary = useAppStore((s) => s.myLibrary);
  const setMyLibrary = useAppStore((s) => s.setMyLibrary);
  const gamePaths = useAppStore((s) => s.gamePaths);
  const navigateToGame = useAppStore((s) => s.navigateToGame);
  const addLog = useLogStore((s) => s.addLog);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return gameRegistry;
    const q = search.toLowerCase();
    return gameRegistry.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        g.family.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q),
    );
  }, [gameRegistry, search]);

  // Group by family
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const g of filtered) {
      const list = map.get(g.family) || [];
      list.push(g);
      map.set(g.family, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleAdd = async (gameId: string) => {
    try {
      await cmd.addToLibrary(gameId);
      setMyLibrary([...myLibrary, gameId]);
      addLog(`Added ${gameRegistry.find((g) => g.id === gameId)?.label} to library`, "success");
      toastSuccess("Game added to library");
    } catch (e) {
      addLog(`Failed to add game: ${e}`, "error");
    }
  };

  const handleRemove = async (gameId: string) => {
    try {
      await cmd.removeFromLibrary(gameId);
      setMyLibrary(myLibrary.filter((id) => id !== gameId));
      addLog(`Removed ${gameRegistry.find((g) => g.id === gameId)?.label} from library`, "info");
    } catch (e) {
      addLog(`Failed to remove game: ${e}`, "error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Game Browser</h2>
        <p className="text-sm text-txt-dim mt-1">
          Browse supported games and add them to your library.
        </p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-dim" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search games..."
          className="w-full bg-bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {grouped.map(([family, games]) => (
        <div key={family}>
          <p className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-2">
            {family}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {games.map((game) => {
              const inLibrary = myLibrary.includes(game.id);
              const detected = !!gamePaths[game.id];

              return (
                <div
                  key={game.id}
                  className={`bg-bg-card rounded-xl border p-4 transition-colors ${
                    inLibrary ? "border-accent/50" : "border-border hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <GameIcon iconName={game.icon} size={18} className={game.color} />
                    <span className="font-medium text-sm truncate">{game.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    {detected && (
                      <span className="text-[10px] bg-status-green/20 text-status-green px-1.5 py-0.5 rounded-full font-medium">
                        Detected
                      </span>
                    )}
                    <span className="text-[10px] text-txt-dim">
                      {game.content_types.length} content type{game.content_types.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {inLibrary ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigateToGame(game.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 text-accent-light text-xs font-medium transition-colors hover:bg-accent/30"
                      >
                        <Check size={12} />
                        Added
                      </button>
                      <button
                        onClick={() => handleRemove(game.id)}
                        className="px-2 py-1.5 rounded-lg bg-bg border border-border text-txt-dim text-xs hover:bg-bg-card-hover hover:text-status-red transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAdd(game.id)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-light text-white text-xs font-medium transition-colors"
                    >
                      <Plus size={12} />
                      Add to Library
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-txt-dim">
          <p>No games match your search</p>
        </div>
      )}
    </div>
  );
}
