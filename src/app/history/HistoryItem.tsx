import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Ellipsis,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import type { HistoryEntry } from "@/bindings";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import { copyToClipboard } from "@/components/settings/history/clipboard";
import { finalText, isPostProcessed } from "@/stores/historyStore";
import { formatTime } from "../lib/format";
import { wordDiff } from "./wordDiff";

interface HistoryItemProps {
  entry: HistoryEntry;
  open: boolean;
  onToggle: () => void;
  retrying: boolean;
  /** Nom de la consigne d'IA qui a produit la correction, si on le retrouve. */
  promptName: string | null;
  getAudioUrl: (fileName: string) => Promise<string | null>;
  onToggleSaved: () => void;
  onDelete: () => void;
  onRetry: () => void;
}

const IaBox: React.FC<{
  raw: string;
  corrected: string;
  promptName: string | null;
  view: "corrected" | "raw";
  onView: (view: "corrected" | "raw") => void;
}> = ({ raw, corrected, promptName, view, onView }) => {
  const { t } = useTranslation();
  const parts = useMemo(() => wordDiff(raw, corrected), [raw, corrected]);
  const shown = parts.filter((p) =>
    view === "corrected" ? p.kind !== "del" : p.kind !== "ins",
  );
  return (
    <div className="j-ia-box">
      <div className="j-ia-h">
        <b>
          <Sparkles size={14} aria-hidden="true" />
          <span>
            {promptName
              ? t("app.history.correctedWith", { prompt: promptName })
              : t("app.history.correctedBadge")}
          </span>
        </b>
        <div
          className="j-seg sm"
          role="radiogroup"
          aria-label={t("app.history.versionLabel")}
        >
          <button
            type="button"
            role="radio"
            aria-checked={view === "corrected"}
            onClick={() => onView("corrected")}
          >
            {t("app.history.corrected")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === "raw"}
            onClick={() => onView("raw")}
          >
            {t("app.history.raw")}
          </button>
        </div>
      </div>
      <p className="j-diff j-selectable m-0">
        {shown.map((part, index) => {
          const text =
            part.kind === "same" && view === "raw" ? part.raw : part.text;
          // Une ponctuation seule (« : » ajouté) n'est pas surlignée.
          const wordLike = /[\p{L}\p{N}]/u.test(text ?? "");
          const node = !wordLike ? (
            text
          ) : part.kind === "ins" ? (
            <ins>{text}</ins>
          ) : part.kind === "del" ? (
            <del>{text}</del>
          ) : (
            text
          );
          return (
            <React.Fragment key={index}>
              {index > 0 && " "}
              {node}
            </React.Fragment>
          );
        })}
      </p>
      <div className="j-diff-lg">
        {view === "corrected" ? (
          <span>
            <ins>{t("app.history.legendAddedSample")}</ins>{" "}
            {t("app.history.legendAdded")}
          </span>
        ) : (
          <span>
            <del>{t("app.history.legendRemovedSample")}</del>{" "}
            {t("app.history.legendRemoved")}
          </span>
        )}
      </div>
    </div>
  );
};

export const HistoryItem: React.FC<HistoryItemProps> = ({
  entry,
  open,
  onToggle,
  retrying,
  promptName,
  getAudioUrl,
  onToggleSaved,
  onDelete,
  onRetry,
}) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"corrected" | "raw">("corrected");
  const [autoPlay, setAutoPlay] = useState(false);
  const corrected = isPostProcessed(entry);
  const text = view === "raw" ? entry.transcription_text : finalText(entry);
  const hasText = text.trim().length > 0;

  const loadAudio = useCallback(
    () => getAudioUrl(entry.file_name),
    [getAudioUrl, entry.file_name],
  );

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasText) return;
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast.error(t("settings.history.copyError"));
      return;
    }
    setCopied(true);
    toast(t("app.home.copiedToast"), {
      icon: <Check size={16} aria-hidden="true" />,
    });
    setTimeout(() => setCopied(false), 1600);
  };

  const stop = (e: React.MouseEvent | React.KeyboardEvent) =>
    e.stopPropagation();

  return (
    <div
      className={`j-item ${open ? "open" : ""}`}
      onClick={onToggle}
      role="listitem"
    >
      <span className="tm j-num">
        {formatTime(entry.timestamp, i18n.language)}
      </span>
      <div
        className={`tx ${retrying ? "retrying" : hasText ? "" : "failed"} ${
          open ? "j-selectable" : ""
        }`}
        onClick={open ? stop : undefined}
      >
        {corrected && (
          <span className="j-chip ia" title={t("app.history.correctedBadge")}>
            {t("app.history.iaBadge")}
          </span>
        )}
        {retrying
          ? t("settings.history.transcribing")
          : hasText
            ? finalText(entry)
            : t("settings.history.transcriptionFailed")}
      </div>
      <div className="acts" onClick={stop}>
        <button
          type="button"
          className="j-ibtn sm"
          title={t("app.history.play")}
          aria-label={t("app.history.play")}
          onClick={() => {
            setAutoPlay(true);
            if (!open) onToggle();
          }}
        >
          <Play size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="j-ibtn sm"
          title={t("settings.history.copyToClipboard")}
          aria-label={t("settings.history.copyToClipboard")}
          onClick={copy}
          disabled={!hasText || retrying}
        >
          {copied ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className={`j-ibtn sm ${entry.saved ? "on" : ""}`}
          title={
            entry.saved
              ? t("settings.history.unsave")
              : t("settings.history.save")
          }
          aria-label={
            entry.saved
              ? t("settings.history.unsave")
              : t("settings.history.save")
          }
          aria-pressed={entry.saved}
          onClick={onToggleSaved}
          disabled={retrying}
        >
          <Star
            size={16}
            fill={entry.saved ? "currentColor" : "none"}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          className="j-ibtn sm"
          title={t("app.history.more")}
          aria-label={t("app.history.more")}
          aria-expanded={open}
          onClick={onToggle}
        >
          <Ellipsis size={16} aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div className="more" onClick={stop}>
          <AudioPlayer onLoadRequest={loadAudio} autoStart={autoPlay}>
            <button
              type="button"
              className="j-btn ghost sm"
              onClick={onRetry}
              disabled={retrying}
            >
              <RotateCcw
                size={14}
                className={retrying ? "j-spin" : ""}
                aria-hidden="true"
              />
              {t("settings.history.retranscribe")}
            </button>
            <button
              type="button"
              className="j-ibtn sm"
              title={t("settings.history.delete")}
              aria-label={t("settings.history.delete")}
              onClick={onDelete}
              disabled={retrying}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </AudioPlayer>
          {corrected && (
            <IaBox
              raw={entry.transcription_text}
              corrected={entry.post_processed_text ?? ""}
              promptName={promptName}
              view={view}
              onView={setView}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryItem;
