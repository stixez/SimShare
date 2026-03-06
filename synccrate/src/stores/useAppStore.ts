import { create } from "zustand";
import type {
  BackupInfo,
  FileManifest,
  GameDefinition,
  GameInfo,
  ModCompatibility,
  ModProfile,
  Page,
  PeerInfo,
  SessionStatus,
  SyncPlan,
  SyncProgress,
} from "../lib/types";

interface AppState {
  page: Page;
  setPage: (page: Page) => void;

  // Game registry loaded from backend
  gameRegistry: GameDefinition[];
  setGameRegistry: (registry: GameDefinition[]) => void;

  // User's personal game library (game IDs)
  myLibrary: string[];
  setMyLibrary: (library: string[]) => void;

  // Currently selected game in sidebar (drives Dashboard/Content/Profiles/Backups views)
  selectedGame: string | null;
  setSelectedGame: (game: string | null) => void;

  // Active content type tab within a game's Content page
  activeContentTab: string | null;
  setActiveContentTab: (tab: string | null) => void;

  gamePaths: Record<string, string>;
  setGamePaths: (paths: Record<string, string>) => void;

  // Backend active game (used for sync/session context)
  activeGame: string;
  setActiveGame: (game: string) => void;

  manifest: FileManifest | null;
  setManifest: (manifest: FileManifest | null) => void;

  session: SessionStatus | null;
  setSession: (session: SessionStatus | null) => void;

  discoveredPeers: PeerInfo[];
  setDiscoveredPeers: (peers: PeerInfo[]) => void;

  syncPlan: SyncPlan | null;
  setSyncPlan: (plan: SyncPlan | null) => void;

  syncProgress: SyncProgress | null;
  setSyncProgress: (progress: SyncProgress | null) => void;

  profiles: ModProfile[];
  setProfiles: (profiles: ModProfile[]) => void;

  showDonate: boolean;
  setShowDonate: (show: boolean) => void;

  donationMilestone: number | null;
  setDonationMilestone: (milestone: number | null) => void;

  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;

  modTags: Record<string, string[]>;
  setModTags: (tags: Record<string, string[]>) => void;

  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;

  backups: BackupInfo[];
  setBackups: (backups: BackupInfo[]) => void;

  excludePatterns: string[];
  setExcludePatterns: (patterns: string[]) => void;

  gameInfo: GameInfo | null;
  setGameInfo: (info: GameInfo | null) => void;

  modCompatibility: ModCompatibility[];
  setModCompatibility: (compat: ModCompatibility[]) => void;

  modSearch: string;
  setModSearch: (search: string) => void;
  modFilter: "all" | "mod" | "cc";
  setModFilter: (filter: "all" | "mod" | "cc") => void;
  modTagFilter: string | null;
  setModTagFilter: (tag: string | null) => void;

  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;

  // Compound navigation helpers
  navigateToGame: (gameId: string, page?: Page) => void;
  navigateToGlobal: (page: Page) => void;
}

export const useAppStore = create<AppState>((set) => ({
  page: "dashboard",
  setPage: (page) => set({ page }),

  gameRegistry: [],
  setGameRegistry: (registry) => set({ gameRegistry: registry }),

  myLibrary: [],
  setMyLibrary: (library) => set({ myLibrary: library }),

  selectedGame: null,
  setSelectedGame: (game) => set({ selectedGame: game }),

  activeContentTab: null,
  setActiveContentTab: (tab) => set({ activeContentTab: tab }),

  gamePaths: {},
  setGamePaths: (paths) => set({ gamePaths: paths }),

  activeGame: "sims4",
  setActiveGame: (game) => set({ activeGame: game }),

  manifest: null,
  setManifest: (manifest) => set({ manifest }),

  session: null,
  setSession: (session) => set({ session }),

  discoveredPeers: [],
  setDiscoveredPeers: (peers) => set({ discoveredPeers: peers }),

  syncPlan: null,
  setSyncPlan: (plan) => set({ syncPlan: plan }),

  syncProgress: null,
  setSyncProgress: (progress) => set({ syncProgress: progress }),

  profiles: [],
  setProfiles: (profiles) => set({ profiles }),

  showDonate: false,
  setShowDonate: (show) => set({ showDonate: show }),

  donationMilestone: null,
  setDonationMilestone: (milestone) => set({ donationMilestone: milestone }),

  isScanning: false,
  setIsScanning: (scanning) => set({ isScanning: scanning }),

  modTags: {},
  setModTags: (tags) => set({ modTags: tags }),

  isDragging: false,
  setIsDragging: (dragging) => set({ isDragging: dragging }),

  backups: [],
  setBackups: (backups) => set({ backups }),

  excludePatterns: [],
  setExcludePatterns: (patterns) => set({ excludePatterns: patterns }),

  gameInfo: null,
  setGameInfo: (info) => set({ gameInfo: info }),

  modCompatibility: [],
  setModCompatibility: (compat) => set({ modCompatibility: compat }),

  modSearch: "",
  setModSearch: (search) => set({ modSearch: search }),
  modFilter: "all",
  setModFilter: (filter) => set({ modFilter: filter }),
  modTagFilter: null,
  setModTagFilter: (tag) => set({ modTagFilter: tag }),

  theme:
    (localStorage.getItem("synccrate-theme") as "dark" | "light") || "dark",
  setTheme: (theme) => {
    localStorage.setItem("synccrate-theme", theme);
    document.documentElement.classList.toggle("light", theme === "light");
    set({ theme });
  },

  navigateToGame: (gameId, page) =>
    set((state) => ({
      selectedGame: gameId,
      page: page ?? "dashboard",
      // Clear stale data when switching to a different game
      ...(state.selectedGame !== gameId
        ? { manifest: null, activeContentTab: null, modCompatibility: [] }
        : {}),
    })),
  navigateToGlobal: (page) => set({ page, selectedGame: null }),
}));
