import { create } from "zustand";

export type SettingsTab = "dictation" | "sound" | "text" | "app" | "about";

export const SETTINGS_TABS: SettingsTab[] = [
  "dictation",
  "sound",
  "text",
  "app",
  "about",
];

interface NavigationStore {
  settingsOpen: boolean;
  tab: SettingsTab;
  modelsOpen: boolean;
  historyOpen: boolean;
  /** Ligne de réglage à mettre en avant à l'ouverture (ex. le micro). */
  focusTarget: string | null;

  openSettings: (tab?: SettingsTab, focusTarget?: string) => void;
  closeSettings: () => void;
  setTab: (tab: SettingsTab) => void;
  openModels: () => void;
  closeModels: () => void;
  openHistory: () => void;
  closeHistory: () => void;
  goHome: () => void;
  clearFocusTarget: () => void;
}

/** Ce qui est ouvert dans la fenêtre principale. */
export const useNavigationStore = create<NavigationStore>()((set) => ({
  settingsOpen: false,
  tab: "dictation",
  modelsOpen: false,
  historyOpen: false,
  focusTarget: null,

  openSettings: (tab, focusTarget) =>
    set((s) => ({
      settingsOpen: true,
      historyOpen: false,
      modelsOpen: false,
      tab: tab ?? s.tab,
      focusTarget: focusTarget ?? null,
    })),
  closeSettings: () => set({ settingsOpen: false, modelsOpen: false }),
  setTab: (tab) => set({ tab, modelsOpen: false }),
  openModels: () =>
    set({
      settingsOpen: true,
      historyOpen: false,
      tab: "dictation",
      modelsOpen: true,
    }),
  closeModels: () => set({ modelsOpen: false }),
  openHistory: () =>
    set({ historyOpen: true, settingsOpen: false, modelsOpen: false }),
  closeHistory: () => set({ historyOpen: false }),
  goHome: () =>
    set({ historyOpen: false, settingsOpen: false, modelsOpen: false }),
  clearFocusTarget: () => set({ focusTarget: null }),
}));
