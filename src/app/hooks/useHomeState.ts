import { useTranslation } from "react-i18next";
import type { PersoMood } from "@/character/Perso";
import { useDictationStore } from "@/stores/dictationStore";
import { useModelStatusStore } from "@/stores/modelStatusStore";
import { useModelStore } from "@/stores/modelStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { modelName } from "../lib/modelText";

export type HomeState =
  | "ready"
  | "loading"
  | "downloading"
  | "nomic"
  | "micDenied"
  | "nomodel"
  | "error"
  | "listening"
  | "writing"
  | "processing"
  | "done";

const MOODS: Record<HomeState, PersoMood> = {
  ready: "pret",
  done: "pret",
  loading: "chargement",
  downloading: "chargement",
  nomic: "micro-absent",
  micDenied: "micro-absent",
  nomodel: "micro-absent",
  error: "erreur",
  listening: "ecoute",
  writing: "frappe",
  processing: "chuchote",
};

export type DotKind = "" | "warn" | "err" | "rec";

const DOTS: Record<HomeState, DotKind> = {
  ready: "",
  done: "",
  loading: "warn",
  downloading: "warn",
  nomodel: "warn",
  writing: "warn",
  processing: "warn",
  nomic: "err",
  micDenied: "err",
  error: "err",
  listening: "rec",
};

export interface HomeStatus {
  state: HomeState;
  mood: PersoMood;
  dot: DotKind;
  /** Nom du modèle actif (ou en cours de téléchargement). */
  model: string;
  downloadPercent: number | null;
  downloadSpeed: number | null;
  error: string | null;
}

/**
 * Ce que l'accueil affiche : dictée en cours d'abord, puis l'état du modèle
 * et du micro.
 */
export const useHomeState = (): HomeStatus => {
  const { t } = useTranslation();
  const dictation = useDictationStore((s) => s.state);
  const justDone = useDictationStore((s) => s.justDone);
  const micProblem = useDictationStore((s) => s.micProblem);
  const status = useModelStatusStore((s) => s.status);
  const statusError = useModelStatusStore((s) => s.error);
  const pendingModelId = useModelStatusStore((s) => s.pendingModelId);
  const models = useModelStore((s) => s.models);
  const currentModel = useModelStore((s) => s.currentModel);
  const downloadProgress = useModelStore((s) => s.downloadProgress);
  const downloadStats = useModelStore((s) => s.downloadStats);
  const downloadingModels = useModelStore((s) => s.downloadingModels);
  const inputDeviceCount = useSettingsStore((s) => s.inputDeviceCount);

  const displayId = pendingModelId || currentModel;
  const current = models.find((m) => m.id === displayId);
  const downloadingId =
    Object.keys(downloadProgress)[0] ?? Object.keys(downloadingModels)[0];
  const downloading = downloadingId
    ? models.find((m) => m.id === downloadingId)
    : undefined;

  let state: HomeState;
  if (dictation === "recording") state = "listening";
  else if (dictation === "transcribing") state = "writing";
  else if (dictation === "processing") state = "processing";
  else if (justDone) state = "done";
  else if (!currentModel) state = downloadingId ? "downloading" : "nomodel";
  else if (status === "error") state = "error";
  else if (status === "loading") state = "loading";
  else if (micProblem === "denied") state = "micDenied";
  else if (micProblem === "no-device" || inputDeviceCount === 0)
    state = "nomic";
  else state = "ready";

  const progress = downloadingId ? downloadProgress[downloadingId] : undefined;
  const speed = downloadingId ? downloadStats[downloadingId]?.speed : undefined;

  return {
    state,
    mood: MOODS[state],
    dot: DOTS[state],
    model:
      state === "downloading" && downloading
        ? modelName(downloading, t)
        : current
          ? modelName(current, t)
          : "",
    downloadPercent: progress ? Math.round(progress.percentage) : null,
    downloadSpeed: speed && speed > 0 ? speed : null,
    error: statusError,
  };
};
