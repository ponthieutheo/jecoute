import { create } from "zustand";
import { commands, events, type HistoryEntry } from "@/bindings";

const PAGE_SIZE = 30;

interface HistoryStore {
  entries: HistoryEntry[];
  hasMore: boolean;
  loading: boolean;
  initialized: boolean;
  /** Dernière dictée arrivée pendant que l'app tourne (animation d'entrée). */
  lastAddedId: number | null;
  /** Dictées en cours de retranscription. */
  retrying: Record<number, true>;

  initialize: () => Promise<void>;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  loadAll: () => Promise<void>;
  toggleSaved: (id: number) => Promise<void>;
  remove: (id: number) => Promise<boolean>;
  retry: (id: number) => Promise<boolean>;
}

let loadingMore = false;

/**
 * Historique des dictées, partagé par l'accueil (trois dernières) et l'écran
 * Historique. Pagination par curseur (id), mises à jour poussées par le cœur.
 */
export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  entries: [],
  hasMore: true,
  loading: true,
  initialized: false,
  lastAddedId: null,
  retrying: {},

  reload: async () => {
    set({ loading: true });
    try {
      const result = await commands.getHistoryEntries(null, PAGE_SIZE);
      if (result.status === "ok") {
        set({ entries: result.data.entries, hasMore: result.data.has_more });
      }
    } catch (error) {
      console.error("Failed to load history entries:", error);
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { entries, hasMore } = get();
    if (!hasMore || loadingMore) return;
    const last = entries[entries.length - 1];
    if (!last) return;
    loadingMore = true;
    try {
      const result = await commands.getHistoryEntries(last.id, PAGE_SIZE);
      if (result.status === "ok") {
        const known = new Set(get().entries.map((e) => e.id));
        set({
          entries: [
            ...get().entries,
            ...result.data.entries.filter((e) => !known.has(e.id)),
          ],
          hasMore: result.data.has_more,
        });
      }
    } catch (error) {
      console.error("Failed to load more history entries:", error);
    } finally {
      loadingMore = false;
    }
  },

  // La recherche et les filtres portent sur tout l'historique : on charge les
  // pages restantes (l'historique est borné par la limite des réglages).
  loadAll: async () => {
    for (let guard = 0; guard < 200 && get().hasMore; guard++) {
      const before = get().entries.length;
      await get().loadMore();
      if (get().entries.length === before && loadingMore === false) break;
    }
  },

  toggleSaved: async (id) => {
    const flip = () =>
      set({
        entries: get().entries.map((e) =>
          e.id === id ? { ...e, saved: !e.saved } : e,
        ),
      });
    flip();
    try {
      const result = await commands.toggleHistoryEntrySaved(id);
      if (result.status !== "ok") flip();
    } catch (error) {
      console.error("Failed to toggle saved status:", error);
      flip();
    }
  },

  remove: async (id) => {
    const previous = get().entries;
    set({ entries: previous.filter((e) => e.id !== id) });
    try {
      const result = await commands.deleteHistoryEntry(id);
      if (result.status !== "ok") {
        await get().reload();
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to delete entry:", error);
      await get().reload();
      return false;
    }
  },

  retry: async (id) => {
    set({ retrying: { ...get().retrying, [id]: true } });
    try {
      const result = await commands.retryHistoryEntryTranscription(id);
      return result.status === "ok";
    } catch (error) {
      console.error("Failed to re-transcribe:", error);
      return false;
    } finally {
      const { [id]: _done, ...rest } = get().retrying;
      set({ retrying: rest });
    }
  },

  initialize: async () => {
    if (get().initialized) return;
    set({ initialized: true });
    await get().reload();
    events.historyUpdatePayload.listen((event) => {
      const payload = event.payload;
      if (payload.action === "added") {
        set({
          entries: [
            payload.entry,
            ...get().entries.filter((e) => e.id !== payload.entry.id),
          ],
          lastAddedId: payload.entry.id,
        });
      } else if (payload.action === "updated") {
        set({
          entries: get().entries.map((e) =>
            e.id === payload.entry.id ? payload.entry : e,
          ),
        });
      } else if (payload.action === "deleted") {
        // Suppressions faites ailleurs (nettoyage automatique) ; sans effet
        // si l'entrée a déjà été retirée ici.
        set({ entries: get().entries.filter((e) => e.id !== payload.id) });
      }
      // « toggled » est déjà appliqué de façon optimiste.
    });
  },
}));

/** Texte final d'une dictée : la version corrigée par l'IA si elle existe. */
export const finalText = (entry: HistoryEntry): string =>
  entry.post_processed_text?.trim()
    ? entry.post_processed_text
    : entry.transcription_text;

export const isPostProcessed = (entry: HistoryEntry): boolean =>
  !!entry.post_processed_text?.trim();
