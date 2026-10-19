import { create } from "zustand";
import { commands, events, type Call, type CallsState } from "@/bindings";

interface CallsStore {
  state: CallsState | null;
  /** L'appel ouvert dans la page Appels. */
  selectedId: string | null;
  /** Son contenu complet (transcription, résumé…). */
  selected: Call | null;
  /** L'appel en cours, avec sa transcription en direct (pour l'accueil). */
  live: Call | null;
  /** Code de la dernière erreur au démarrage (« no-model », « mic »…). */
  startError: string | null;
  initialized: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  select: (id: string | null) => Promise<void>;
  start: () => Promise<string | null>;
  stop: () => Promise<void>;
  clearStartError: () => void;
}

const loadCall = async (id: string): Promise<Call | null> => {
  try {
    const result = await commands.callGet(id);
    return result.status === "ok" ? result.data : null;
  } catch {
    return null;
  }
};

let refreshing: Promise<void> | null = null;
let again = false;

/** Les appels enregistrés, tenus à jour par l'événement « calls-changed ». */
export const useCallsStore = create<CallsStore>()((set, get) => ({
  state: null,
  selectedId: null,
  selected: null,
  live: null,
  startError: null,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true });
    await events.callsChanged.listen(() => {
      void get().refresh();
    });
    await get().refresh();
  },

  // Une seule lecture à la fois ; un événement reçu entre-temps en relance une.
  refresh: async () => {
    if (refreshing) {
      again = true;
      return refreshing;
    }
    refreshing = (async () => {
      do {
        again = false;
        try {
          const result = await commands.callsState();
          if (result.status !== "ok") continue;
          const state = result.data;
          const recordingId = state.recording?.id ?? null;
          let { selectedId } = get();
          if (selectedId && !state.calls.some((c) => c.id === selectedId)) {
            selectedId = state.calls[0]?.id ?? null;
          }
          const [selected, live] = await Promise.all([
            selectedId ? loadCall(selectedId) : Promise.resolve(null),
            recordingId
              ? recordingId === selectedId
                ? null
                : loadCall(recordingId)
              : Promise.resolve(null),
          ]);
          set({
            state,
            selectedId,
            selected,
            live: recordingId === selectedId ? selected : live,
          });
        } catch (error) {
          console.error("Failed to read the calls:", error);
        }
      } while (again);
    })();
    try {
      await refreshing;
    } finally {
      refreshing = null;
    }
  },

  select: async (id) => {
    set({ selectedId: id, selected: id ? get().selected : null });
    if (!id) return;
    const call = await loadCall(id);
    if (get().selectedId === id) set({ selected: call });
  },

  start: async () => {
    set({ startError: null });
    try {
      const result = await commands.callStart();
      if (result.status !== "ok") {
        set({ startError: result.error });
        return null;
      }
      set({ selectedId: result.data });
      await get().refresh();
      return result.data;
    } catch (error) {
      set({ startError: String(error) });
      return null;
    }
  },

  stop: async () => {
    await commands.callStop();
    await get().refresh();
  },

  clearStartError: () => set({ startError: null }),
}));
