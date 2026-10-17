import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { events } from "@/bindings";
import type { RecordingErrorEvent } from "@/lib/types/events";

/** État de dictée envoyé par le cœur à la fenêtre principale. */
export type DictationState =
  | "idle"
  | "recording"
  | "transcribing"
  | "processing";

export type MicProblem = "none" | "no-device" | "denied";

const DONE_MS = 1800;

interface DictationStore {
  state: DictationState;
  /** 16 bandes 0..1 pendant l'enregistrement, null sinon. */
  levels: number[] | null;
  /** Une dictée vient d'écrire du texte, sans erreur (affiché un court instant). */
  justDone: boolean;
  /** Dernier problème de micro signalé par le cœur. */
  micProblem: MicProblem;
  initialized: boolean;
  initialize: () => void;
  clearMicProblem: () => void;
}

const STATES: DictationState[] = [
  "idle",
  "recording",
  "transcribing",
  "processing",
];

let doneTimer: ReturnType<typeof setTimeout> | undefined;
let cycleFailed = false;
// Une dictée vide (silence, tout coupé par la détection de voix) n'écrit rien :
// pas de « C'est collé » dans ce cas.
let cycleWrote = false;

/**
 * Écoute « dictation-state » et « main-mic-level » (noms en dur, émis par
 * src-tauri/src/overlay.rs) ainsi que les erreurs d'enregistrement.
 */
export const useDictationStore = create<DictationStore>()((set, get) => ({
  state: "idle",
  levels: null,
  justDone: false,
  micProblem: "none",
  initialized: false,

  clearMicProblem: () => set({ micProblem: "none" }),

  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });

    listen<string>("dictation-state", (event) => {
      const next = STATES.includes(event.payload as DictationState)
        ? (event.payload as DictationState)
        : "idle";
      const previous = get().state;
      if (next === previous) return;

      if (next === "recording") {
        cycleFailed = false;
        cycleWrote = false;
        clearTimeout(doneTimer);
        set({ state: next, justDone: false, micProblem: "none" });
        return;
      }
      if (next === "idle") {
        const finished =
          (previous === "transcribing" || previous === "processing") &&
          !cycleFailed &&
          cycleWrote;
        set({ state: next, levels: null, justDone: finished });
        clearTimeout(doneTimer);
        if (finished) {
          doneTimer = setTimeout(() => set({ justDone: false }), DONE_MS);
        }
        return;
      }
      set({ state: next, levels: null });
    });

    listen<number[]>("main-mic-level", (event) => {
      if (get().state !== "recording") return;
      const payload = event.payload;
      if (Array.isArray(payload)) set({ levels: payload });
    });

    listen<RecordingErrorEvent>("recording-error", (event) => {
      cycleFailed = true;
      const type = event.payload.error_type;
      if (type === "no_input_device") set({ micProblem: "no-device" });
      else if (type === "microphone_permission_denied")
        set({ micProblem: "denied" });
    });
    listen("transcription-error", () => {
      cycleFailed = true;
    });
    listen("paste-error", () => {
      cycleFailed = true;
    });
    // L'entrée d'historique arrive avant le retour à « idle ».
    events.historyUpdatePayload.listen((event) => {
      const p = event.payload;
      if (p.action !== "added") return;
      const text = p.entry.post_processed_text || p.entry.transcription_text;
      if (text.trim()) cycleWrote = true;
    });
  },
}));
