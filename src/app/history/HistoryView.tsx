import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { convertFileSrc } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import { ArrowLeft, FolderOpen, Search } from "lucide-react";
import { commands, type HistoryEntry } from "@/bindings";
import { useOsType } from "@/hooks/useOsType";
import { useSettingsStore } from "@/stores/settingsStore";
import {
  finalText,
  isPostProcessed,
  useHistoryStore,
} from "@/stores/historyStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { AudioPlayerGroup } from "@/components/ui/AudioPlayer";
import { dayKey, formatDay, twelveHour } from "../lib/format";
import { HistoryItem } from "./HistoryItem";
import { useInert } from "../hooks/useInert";

type Filter = "all" | "favorites" | "corrected";

/** L'historique complet : recherche, filtres, liste par jour. */
export const HistoryView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const osType = useOsType();
  const isOpen = useNavigationStore((s) => s.historyOpen);
  const close = useNavigationStore((s) => s.closeHistory);
  const {
    entries,
    hasMore,
    loading,
    retrying,
    loadMore,
    loadAll,
    toggleSaved,
    remove,
    retry,
  } = useHistoryStore();
  const prompts = useSettingsStore(
    (s) => s.settings?.post_process_prompts ?? [],
  );
  const historyLimit = useSettingsStore((s) => s.settings?.history_limit);
  const retention = useSettingsStore(
    (s) => s.settings?.recording_retention_period,
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rootRef = useInert<HTMLDivElement>(!isOpen);

  // Recherche et filtres : sur tout l'historique.
  const filtering = query.trim() !== "" || filter !== "all";
  useEffect(() => {
    if (filtering && hasMore) void loadAll();
  }, [filtering, hasMore, loadAll]);

  // Échap revient à l'accueil ; Ctrl+F cherche.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape" && !document.querySelector(".j-menu")) {
        close();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // Défilement infini.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (items) => {
        if (items[0]?.isIntersecting) void loadMore();
      },
      { root: listRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore, entries.length]);

  const promptName = useCallback(
    (entry: HistoryEntry) =>
      prompts.find((p) => p.prompt === entry.post_process_prompt)?.name ?? null,
    [prompts],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (filter === "favorites" && !entry.saved) return false;
      if (filter === "corrected" && !isPostProcessed(entry)) return false;
      if (!q) return true;
      return (
        finalText(entry).toLocaleLowerCase().includes(q) ||
        entry.transcription_text.toLocaleLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  const groups = useMemo(() => {
    const out: { key: number; label: string; items: HistoryEntry[] }[] = [];
    for (const entry of visible) {
      const key = dayKey(entry.timestamp);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(entry);
      else
        out.push({
          key,
          label: formatDay(entry.timestamp, i18n.language, t),
          items: [entry],
        });
    }
    return out;
  }, [visible, i18n.language, t]);

  const getAudioUrl = useCallback(
    async (fileName: string) => {
      try {
        const result = await commands.getAudioFilePath(fileName);
        if (result.status !== "ok") return null;
        if (osType === "linux") {
          const data = await readFile(result.data);
          return URL.createObjectURL(new Blob([data], { type: "audio/wav" }));
        }
        return convertFileSrc(result.data, "asset");
      } catch (error) {
        console.error("Failed to get audio file path:", error);
        return null;
      }
    },
    [osType],
  );

  const openFolder = async () => {
    try {
      const result = await commands.openRecordingsFolder();
      if (result.status !== "ok") throw new Error(String(result.error));
    } catch (error) {
      console.error("Failed to open recordings folder:", error);
    }
  };

  const countLabel = (() => {
    if (hasMore) return t("app.history.countMore", { count: entries.length });
    if (
      retention === "preserve_limit" &&
      historyLimit &&
      entries.length <= historyLimit
    ) {
      return t("app.history.countKept", {
        count: entries.length,
        limit: historyLimit,
      });
    }
    return t("app.history.count", { count: entries.length });
  })();

  // Colonne des heures : plus large sur 12 h (« 11:20 AM »).
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("app.history.filters.all") },
    { id: "favorites", label: t("app.history.filters.favorites") },
    { id: "corrected", label: t("app.history.filters.corrected") },
  ];

  let body: React.ReactNode;
  if (loading && entries.length === 0) {
    body = <div className="j-h-empty">{t("settings.history.loading")}</div>;
  } else if (entries.length === 0) {
    body = <div className="j-h-empty">{t("app.history.empty")}</div>;
  } else if (visible.length === 0) {
    body = <div className="j-h-empty">{t("app.history.noResults")}</div>;
  } else {
    body = (
      <AudioPlayerGroup>
        {groups.map((group) => (
          <section key={group.key} aria-label={group.label}>
            <h3 className="j-day">{group.label}</h3>
            <div role="list">
              {group.items.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  open={openId === entry.id}
                  onToggle={() =>
                    setOpenId((id) => (id === entry.id ? null : entry.id))
                  }
                  retrying={!!retrying[entry.id]}
                  promptName={promptName(entry)}
                  getAudioUrl={getAudioUrl}
                  onToggleSaved={() => void toggleSaved(entry.id)}
                  onDelete={async () => {
                    const ok = await remove(entry.id);
                    if (!ok) toast.error(t("settings.history.deleteError"));
                  }}
                  onRetry={async () => {
                    const ok = await retry(entry.id);
                    if (!ok)
                      toast.error(t("settings.history.retranscribeError"));
                  }}
                />
              ))}
            </div>
          </section>
        ))}
      </AudioPlayerGroup>
    );
  }

  return (
    <div
      ref={rootRef}
      className="j-layer j-history"
      aria-label={t("app.history.title")}
    >
      <div className="j-h-head">
        <button
          type="button"
          className="j-ibtn"
          onClick={close}
          aria-label={t("app.history.back")}
          title={t("app.history.back")}
        >
          <ArrowLeft
            size={20}
            aria-hidden="true"
            className="rtl:-scale-x-100"
          />
        </button>
        <h2 className="j-title">{t("app.history.title")}</h2>
        <label className="j-field">
          <Search size={16} aria-hidden="true" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("app.history.search")}
            aria-label={t("app.history.searchLabel")}
          />
        </label>
        <div
          className="j-seg"
          role="radiogroup"
          aria-label={t("app.history.filters.label")}
        >
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="j-h-list j-scroll"
        ref={listRef}
        style={
          {
            "--j-tm": twelveHour(i18n.language) ? "68px" : "48px",
          } as React.CSSProperties
        }
      >
        {body}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </div>
      <div className="j-h-foot">
        <span className="j-num">{countLabel}</span>
        <button type="button" className="j-btn ghost sm" onClick={openFolder}>
          <FolderOpen size={16} aria-hidden="true" />
          {t("settings.history.openFolder")}
        </button>
      </div>
    </div>
  );
};

export default HistoryView;
