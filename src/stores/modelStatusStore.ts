import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { commands } from "@/bindings";
import type { ModelStateEvent } from "@/lib/types/events";
import { useModelStore } from "./modelStore";

export type ModelStatus = "ready" | "loading" | "error" | "unloaded" | "none";

interface ModelStatusStore {
  status: ModelStatus;
  error: string | null;
  /** Modèle en cours de bascule, affiché avant la fin du chargement. */
  pendingModelId: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  /** Choix d'un modèle téléchargé (accueil, liste des modèles). */
  switchModel: (modelId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * État du modèle de transcription (repris de l'ancien sélecteur du pied de
 * page) : chargement, prêt, erreur, déchargé, aucun ; et sélection
 * automatique d'un modèle dès la fin de son téléchargement.
 */
export const useModelStatusStore = create<ModelStatusStore>()((set, get) => ({
  status: "unloaded",
  error: null,
  pendingModelId: null,
  initialized: false,

  refresh: async () => {
    const currentModel = useModelStore.getState().currentModel;
    if (!currentModel) {
      set({ status: "none" });
      return;
    }
    // Un chargement lancé avant l'ouverture de la fenêtre (préchargement au
    // démarrage) n'a pas été vu par les événements : on le demande.
    try {
      const [result, loading] = await Promise.all([
        commands.getTranscriptionModelStatus(),
        commands.isModelLoading(),
      ]);
      if (result.status === "ok") {
        set((s) => ({
          // Une erreur de chargement reste affichée jusqu'au prochain essai.
          status:
            s.status === "error"
              ? "error"
              : result.data === currentModel
                ? "ready"
                : loading.status === "ok" && loading.data
                  ? "loading"
                  : "unloaded",
        }));
      }
    } catch {
      set({ status: "error", error: "Failed to check model status" });
    }
  },

  switchModel: async (modelId) => {
    set({ pendingModelId: modelId, error: null, status: "loading" });
    const ok = await useModelStore.getState().selectModel(modelId);
    if (!ok) {
      set({
        pendingModelId: null,
        status: "error",
        error: "Failed to switch model",
      });
    }
    return ok;
  },

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true });

    // Suivre le modèle courant (sélection, suppression…).
    let lastModel = useModelStore.getState().currentModel;
    useModelStore.subscribe((state) => {
      if (state.currentModel !== lastModel) {
        lastModel = state.currentModel;
        if (get().status !== "loading") void get().refresh();
      }
    });

    listen<ModelStateEvent>("model-state-changed", (event) => {
      const { event_type, error } = event.payload;
      switch (event_type) {
        case "loading_started":
          set({ status: "loading", error: null });
          break;
        case "loading_completed":
          set({ status: "ready", error: null, pendingModelId: null });
          break;
        case "loading_failed":
          set({
            status: "error",
            error: error || "Failed to load model",
            pendingModelId: null,
          });
          break;
        case "unloaded":
          set({ status: "unloaded", error: null });
          break;
      }
    });

    // Un modèle qui finit de se télécharger devient le modèle actif (après
    // l'extraction éventuelle), sauf pendant une dictée.
    listen<string>("model-download-complete", (event) => {
      const modelId = event.payload;
      setTimeout(async () => {
        try {
          const recording = await commands.isRecording();
          if (!recording) await get().switchModel(modelId);
        } catch {
          // sélection automatique facultative
        }
      }, 500);
    });

    await get().refresh();
  },
}));
