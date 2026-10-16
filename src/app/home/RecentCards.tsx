import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy, Star } from "lucide-react";
import type { HistoryEntry } from "@/bindings";
import {
  finalText,
  isPostProcessed,
  useHistoryStore,
} from "@/stores/historyStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { copyToClipboard } from "@/components/settings/history/clipboard";
import { formatWhen } from "../lib/format";

const Card: React.FC<{ entry: HistoryEntry; entering: boolean }> = ({
  entry,
  entering,
}) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const text = finalText(entry);
  const empty = !text.trim();

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (empty) return;
    const ok = await copyToClipboard(text);
    if (!ok) {
      toast.error(t("settings.history.copyError"));
      return;
    }
    setCopied(true);
    toast(t("app.home.copiedToast"), {
      icon: <Check size={16} aria-hidden="true" />,
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className={`j-card ${copied ? "copied" : ""} ${entering ? "enter" : ""}`}
      onClick={copy}
      title={t("app.home.copyTitle")}
      disabled={empty}
    >
      <span className="j-card-top">
        <span className="when j-num">
          {formatWhen(entry.timestamp, i18n.language, t)}
        </span>
        {isPostProcessed(entry) && (
          <span className="j-chip ia" title={t("app.history.correctedBadge")}>
            {t("app.history.iaBadge")}
          </span>
        )}
        {entry.saved && (
          <span className="fav" title={t("app.history.favorite")}>
            <Star size={14} fill="currentColor" aria-hidden="true" />
          </span>
        )}
      </span>
      <p>{empty ? t("settings.history.transcriptionFailed") : text}</p>
      <span className="j-btn ghost sm copy" aria-hidden="true">
        {copied ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
        <span>{copied ? t("app.home.copied") : t("common.copy")}</span>
      </span>
    </button>
  );
};

/** Les trois dernières dictées, copiables d'un clic. */
export const RecentCards: React.FC = () => {
  const { t } = useTranslation();
  const entries = useHistoryStore((s) => s.entries);
  const loading = useHistoryStore((s) => s.loading);
  const lastAddedId = useHistoryStore((s) => s.lastAddedId);
  const openHistory = useNavigationStore((s) => s.openHistory);
  const recent = entries.slice(0, 3);

  return (
    <section className="j-recent" aria-labelledby="j-recent-title">
      <div className="j-recent-h">
        <h2 className="j-section" id="j-recent-title">
          {t("app.home.recent")}
        </h2>
        <button type="button" className="j-btn ghost sm" onClick={openHistory}>
          {t("app.home.allHistory")}
        </button>
      </div>
      {recent.length === 0 ? (
        !loading && <div className="j-cards-empty">{t("app.home.empty")}</div>
      ) : (
        <div className="j-cards">
          {recent.map((entry) => (
            <Card
              key={entry.id}
              entry={entry}
              entering={entry.id === lastAddedId}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default RecentCards;
