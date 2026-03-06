import { useState, useMemo } from "react";
import { Gamepad2, Plus, Check, ArrowRight, RefreshCw } from "lucide-react";
import { useAppStore } from "../stores/useAppStore";
import { GameIcon } from "./Sidebar";
import * as cmd from "../lib/commands";

const ONBOARDING_KEY = "synccrate-onboarding-complete";

export function isOnboardingComplete(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_KEY, "1");
}

export default function WelcomeScreen() {
  const gameRegistry = useAppStore((s) => s.gameRegistry);
  const gamePaths = useAppStore((s) => s.gamePaths);
  const myLibrary = useAppStore((s) => s.myLibrary);
  const setMyLibrary = useAppStore((s) => s.setMyLibrary);
  const navigateToGame = useAppStore((s) => s.navigateToGame);
  const navigateToGlobal = useAppStore((s) => s.navigateToGlobal);

  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-select all detected games
    const detected = new Set<string>();
    for (const g of gameRegistry) {
      if (gamePaths[g.id] && !myLibrary.includes(g.id)) {
        detected.add(g.id);
      }
    }
    return detected;
  });
  const [adding, setAdding] = useState(false);

  const detected = useMemo(
    () => gameRegistry.filter((g) => gamePaths[g.id] && !myLibrary.includes(g.id)),
    [gameRegistry, gamePaths, myLibrary],
  );

  const otherGames = useMemo(
    () => gameRegistry.filter((g) => !gamePaths[g.id] && !myLibrary.includes(g.id)),
    [gameRegistry, gamePaths, myLibrary],
  );

  const toggleGame = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGetStarted = async () => {
    if (selected.size === 0) {
      markOnboardingComplete();
      navigateToGlobal("game-browser");
      return;
    }

    setAdding(true);
    const ids = Array.from(selected);
    const added: string[] = [];
    for (const id of ids) {
      try {
        await cmd.addToLibrary(id);
        added.push(id);
      } catch {
        // Skip failed games, continue with the rest
      }
    }
    if (added.length > 0) {
      setMyLibrary([...myLibrary, ...added]);
    }
    markOnboardingComplete();
    if (added.length > 0) {
      await cmd.setActiveGame(added[0]).catch(() => {});
      navigateToGame(added[0]);
    } else {
      navigateToGlobal("game-browser");
    }
    setAdding(false);
  };

  const handleSkip = () => {
    markOnboardingComplete();
    navigateToGlobal("game-browser");
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="max-w-lg w-full text-center">
        {/* Logo + header */}
        <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
          <Gamepad2 size={32} className="text-accent-light" />
        </div>
        <h2 className="text-2xl font-bold mb-1">Welcome to SyncCrate</h2>
        <p className="text-txt-dim text-sm mb-8">
          Sync your game mods, saves, and settings with friends over LAN.
        </p>

        {/* Detected games */}
        {detected.length > 0 && (
          <div className="mb-6 text-left">
            <p className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-3 text-center">
              Games detected on your system
            </p>
            <div className="grid grid-cols-2 gap-2">
              {detected.map((game) => {
                const isSelected = selected.has(game.id);
                return (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                      isSelected
                        ? "bg-accent/15 border-accent/50 text-txt"
                        : "bg-bg-card border-border text-txt-dim hover:border-border hover:text-txt"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-accent text-white" : "bg-bg border border-border"
                    }`}>
                      {isSelected && <Check size={12} />}
                    </div>
                    <GameIcon iconName={game.icon} size={14} className={game.color} />
                    <span className="truncate">{game.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Other games (collapsed) */}
        {otherGames.length > 0 && (
          <div className="mb-6 text-left">
            <p className="text-xs font-semibold text-txt-dim uppercase tracking-wider mb-3 text-center">
              {detected.length > 0 ? "Other supported games" : "Supported games"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {otherGames.map((game) => {
                const isSelected = selected.has(game.id);
                return (
                  <button
                    key={game.id}
                    onClick={() => toggleGame(game.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all text-left ${
                      isSelected
                        ? "bg-accent/15 border-accent/50 text-txt"
                        : "bg-bg-card border-border text-txt-dim hover:border-border hover:text-txt"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                      isSelected ? "bg-accent text-white" : "bg-bg border border-border"
                    }`}>
                      {isSelected && <Check size={12} />}
                    </div>
                    <GameIcon iconName={game.icon} size={14} className={game.color} />
                    <span className="truncate">{game.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* No games at all (registry not loaded yet) */}
        {gameRegistry.length === 0 && (
          <div className="mb-6 flex items-center justify-center gap-2 text-txt-dim text-sm">
            <RefreshCw size={14} className="animate-spin" />
            Loading game registry...
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleGetStarted}
            disabled={adding}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent hover:bg-accent-light text-white font-medium transition-colors disabled:opacity-50"
          >
            {adding ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Adding...
              </>
            ) : selected.size > 0 ? (
              <>
                Get Started
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <Plus size={16} />
                Browse Games
              </>
            )}
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleSkip}
              className="text-sm text-txt-dim hover:text-txt transition-colors"
            >
              Skip
            </button>
          )}
        </div>

        {selected.size > 0 && (
          <p className="text-xs text-txt-dim mt-3">
            {selected.size} game{selected.size !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>
    </div>
  );
}
