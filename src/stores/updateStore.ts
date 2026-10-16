import { create } from "zustand";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { arch, platform } from "@tauri-apps/plugin-os";
import { commands } from "@/bindings";
import {
  PORTABLE_RELEASES_URL,
  resolvePortableInstallerUrl,
} from "@/components/update-checker/portableInstaller";

export type UpdateCheckResult = "idle" | "upToDate" | "available" | "failed";

interface UpdateStore {
  /** Vérification automatique permise (réglage + absence de verrou système). */
  enabled: boolean;
  isChecking: boolean;
  result: UpdateCheckResult;
  availableVersion: string | null;
  isInstalling: boolean;
  /** 0..100 pendant le téléchargement de la mise à jour. */
  downloadProgress: number;
  portableDialogOpen: boolean;
  portableInstallerUrl: string;

  setEnabled: (enabled: boolean) => void;
  checkForUpdates: (manual?: boolean) => Promise<void>;
  installUpdate: () => Promise<void>;
  closePortableDialog: () => void;
}

/**
 * Mises à jour (reprise de l'ancien UpdateChecker du pied de page) : la
 * logique vit ici pour que l'accueil, le menu de la barre des tâches et
 * l'onglet À propos partagent le même état.
 */
export const useUpdateStore = create<UpdateStore>()((set, get) => ({
  enabled: false,
  isChecking: false,
  result: "idle",
  availableVersion: null,
  isInstalling: false,
  downloadProgress: 0,
  portableDialogOpen: false,
  portableInstallerUrl: PORTABLE_RELEASES_URL,

  setEnabled: (enabled) => {
    if (enabled === get().enabled) return;
    set(
      enabled
        ? { enabled }
        : {
            enabled,
            isChecking: false,
            result: "idle",
            availableVersion: null,
          },
    );
  },

  checkForUpdates: async (manual = false) => {
    if (!get().enabled || get().isChecking || get().isInstalling) return;
    set({ isChecking: true });
    try {
      const update = await check();
      if (update) {
        set({
          result: "available",
          availableVersion: update.version ?? null,
          // Les installations portables ne se mettent pas à jour en place :
          // la boîte de dialogue pointe vers l'installeur du manifeste.
          portableInstallerUrl: resolvePortableInstallerUrl(
            update.rawJson,
            platform(),
            arch(),
          ),
        });
      } else {
        set({ result: "upToDate", availableVersion: null });
      }
    } catch (error) {
      console.error("Failed to check for updates:", error);
      if (manual) set({ result: "failed" });
    } finally {
      set({ isChecking: false });
    }
  },

  installUpdate: async () => {
    if (!get().enabled || get().isInstalling) return;

    const portable = await commands.isPortable();
    if (portable) {
      set({ portableDialogOpen: true });
      return;
    }

    let downloaded = 0;
    let contentLength = 0;
    try {
      set({ isInstalling: true, downloadProgress: 0 });
      const update = await check();
      if (!update) {
        set({ result: "upToDate", availableVersion: null });
        return;
      }
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            downloaded = 0;
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress": {
            downloaded += event.data.chunkLength;
            const progress =
              contentLength > 0
                ? Math.round((downloaded / contentLength) * 100)
                : 0;
            set({ downloadProgress: Math.min(progress, 100) });
            break;
          }
        }
      });
      await relaunch();
    } catch (error) {
      console.error("Failed to install update:", error);
    } finally {
      set({ isInstalling: false, downloadProgress: 0 });
    }
  },

  closePortableDialog: () => set({ portableDialogOpen: false }),
}));
