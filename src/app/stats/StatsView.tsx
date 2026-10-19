import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ChartColumn, Flame, RotateCcw } from "lucide-react";
import {
  commands,
  type AppShare,
  type DictationStats,
  type PeriodStats,
} from "@/bindings";
import { Dialog } from "@/components/ui/Dialog";
import { useNavigationStore } from "@/stores/navigationStore";
import { useInert } from "../hooks/useInert";
import { buildSeries, type Bar, type Bucket, type Period } from "./series";

/** Envoyé par le cœur après chaque dictée comptée. */
const STATS_UPDATED_EVENT = "stats-updated";

const useNumber = (language: string) =>
  useMemo(() => new Intl.NumberFormat(language), [language]);

/** « 12 min », « 5 h 10 ». */
const formatDuration = (minutes: number, t: TFunction): string => {
  const m = Math.round(minutes);
  if (m < 60) return t("app.stats.minutes", { m });
  return t("app.stats.hours", {
    h: Math.floor(m / 60),
    m: String(m % 60).padStart(2, "0"),
  });
};

const Tile: React.FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div className="j-st-tile">
    <span className="label">{label}</span>
    <b className="j-num">{value}</b>
    {sub && <span className="sub">{sub}</span>}
  </div>
);

const barLabel = (bar: Bar, bucket: Bucket, language: string): string => {
  if (bucket === "month")
    return new Intl.DateTimeFormat(language, {
      month: "long",
      year: "numeric",
    }).format(bar.start);
  return new Intl.DateTimeFormat(language, {
    weekday: bucket === "day" ? "long" : undefined,
    day: "numeric",
    month: "long",
  }).format(bar.start);
};

const tickLabel = (bar: Bar, bucket: Bucket, language: string): string => {
  if (bucket === "month")
    return new Intl.DateTimeFormat(language, { month: "short" }).format(
      bar.start,
    );
  if (bucket === "week")
    return new Intl.DateTimeFormat(language, {
      day: "numeric",
      month: "short",
    }).format(bar.start);
  return String(bar.start.getDate());
};

const CHART_H = 150;
const AXIS_H = 20;

/** Les mots par jour (ou semaine, ou mois) : des barres en SVG. */
const WordsChart: React.FC<{
  bars: Bar[];
  bucket: Bucket;
  weekdays: boolean;
}> = ({ bars, bucket, weekdays }) => {
  const { t, i18n } = useTranslation();
  const nf = useNumber(i18n.language);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(1, ...bars.map((b) => b.words));
  const slot = bars.length ? width / bars.length : 0;
  const gap = Math.min(6, Math.max(2, slot * 0.25));
  const barW = Math.max(1, slot - gap);
  const every = bars.length <= 8 ? 1 : bars.length <= 31 ? 5 : 8;
  const shownTick = (i: number) =>
    bars.length <= 8 ||
    i === bars.length - 1 ||
    (bars.length - 1 - i) % every === 0;
  const weekday = (bar: Bar) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "short" }).format(
      bar.start,
    );
  const hovered = hover !== null ? bars[hover] : null;

  return (
    <div className="j-st-chart" ref={box} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={CHART_H + AXIS_H}
          role="img"
          aria-label={t("app.stats.chartLabel")}
        >
          <line
            x1={0}
            x2={width}
            y1={CHART_H + 0.5}
            y2={CHART_H + 0.5}
            className="base"
          />
          <line x1={0} x2={width} y1={0.5} y2={0.5} className="grid" />
          {bars.map((bar, i) => {
            const h = bar.words
              ? Math.max(3, (bar.words / max) * (CHART_H - 8))
              : 0;
            const x = i * slot + gap / 2;
            const r = Math.min(4, barW / 2, h);
            return (
              <g key={bar.start.getTime()}>
                {h > 0 ? (
                  <path
                    className={`bar ${bar.current ? "current" : ""} ${hover === i ? "on" : ""}`}
                    d={`M${x},${CHART_H} V${CHART_H - h + r} Q${x},${CHART_H - h} ${x + r},${CHART_H - h} H${x + barW - r} Q${x + barW},${CHART_H - h} ${x + barW},${CHART_H - h + r} V${CHART_H} Z`}
                  />
                ) : (
                  <rect
                    className="zero"
                    x={x}
                    y={CHART_H - 2}
                    width={barW}
                    height={2}
                    rx={1}
                  />
                )}
                <rect
                  className="hit"
                  x={i * slot}
                  y={0}
                  width={slot}
                  height={CHART_H + AXIS_H}
                  onMouseEnter={() => setHover(i)}
                />
                {shownTick(i) && (
                  <text
                    x={i * slot + slot / 2}
                    y={CHART_H + 15}
                    textAnchor="middle"
                    className={`tick ${bar.current ? "current" : ""}`}
                  >
                    {weekdays
                      ? weekday(bar)
                      : tickLabel(bar, bucket, i18n.language)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <span className="j-st-max j-num">
        {nf.format(max === 1 && !bars.some((b) => b.words) ? 0 : max)}
      </span>
      {hovered && hover !== null && (
        <div
          className="j-st-tip"
          style={{
            left: Math.min(
              Math.max(hover * slot + slot / 2, 70),
              Math.max(70, width - 70),
            ),
          }}
          role="status"
        >
          <span>{barLabel(hovered, bucket, i18n.language)}</span>
          <b className="j-num">
            {t("app.stats.wordsCount", {
              count: hovered.words,
              formatted: nf.format(hovered.words),
            })}
          </b>
        </div>
      )}
    </div>
  );
};

/** « Où tu dictes » : les applis de la période, en part des mots. */
const AppsList: React.FC<{ apps: AppShare[] }> = ({ apps }) => {
  const { t, i18n } = useTranslation();
  const pf = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, {
        style: "percent",
        maximumFractionDigits: 0,
      }),
    [i18n.language],
  );
  const total = apps.reduce((sum, a) => sum + a.words, 0);
  if (total === 0)
    return <p className="j-st-none">{t("app.stats.appsEmpty")}</p>;
  const top = apps.slice(0, 5);
  const rest = apps.slice(5).reduce((sum, a) => sum + a.words, 0);
  const rows = rest
    ? [...top, { app: "", name: t("app.stats.otherApps"), words: rest }]
    : top;
  return (
    <ul className="j-st-apps">
      {rows.map((a) => {
        const share = a.words / total;
        return (
          <li key={a.app || "_other"} className={a.app ? "" : "other"}>
            <span className="name" title={a.name}>
              {a.name}
            </span>
            <span className="pct j-num">{pf.format(share)}</span>
            <span className="track" aria-hidden="true">
              <i style={{ width: `${Math.max(2, share * 100)}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
};

const Empty: React.FC = () => {
  const { t } = useTranslation();
  const ghost = [28, 46, 20, 64, 38, 82, 54];
  return (
    <div className="j-st-empty">
      <svg width="168" height="92" aria-hidden="true">
        {ghost.map((h, i) => (
          <rect
            key={i}
            x={i * 24 + 2}
            y={88 - h}
            width={18}
            height={h}
            rx={4}
          />
        ))}
        <line x1="0" x2="168" y1="90.5" y2="90.5" />
      </svg>
      <h3 className="j-section">{t("app.stats.emptyTitle")}</h3>
      <p>{t("app.stats.emptyText")}</p>
    </div>
  );
};

/** La page Statistiques : elle glisse par-dessus l'accueil, comme l'historique. */
export const StatsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const nf = useNumber(i18n.language);
  const isOpen = useNavigationStore((s) => s.statsOpen);
  const close = useNavigationStore((s) => s.closeStats);
  const rootRef = useInert<HTMLDivElement>(!isOpen);
  const [stats, setStats] = useState<DictationStats | null>(null);
  const [period, setPeriod] = useState<Period>("week");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await commands.getDictationStats();
      if (result.status === "ok") setStats(result.data);
      else console.error("Failed to load stats:", result.error);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    const unlisten = listen(STATS_UPDATED_EVENT, () => void load());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [load]);

  // Échap revient à l'accueil.
  useEffect(() => {
    if (!isOpen || confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape" && !document.querySelector(".j-menu")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, confirmOpen, close]);

  const reset = async () => {
    setConfirmOpen(false);
    const result = await commands.resetDictationStats();
    if (result.status !== "ok") toast.error(t("app.stats.resetError"));
    void load();
  };

  const empty = stats !== null && stats.all.dictations === 0;
  const totals: PeriodStats | null = stats ? stats[period] : null;
  const series = useMemo(
    () => (stats ? buildSeries(stats.days, stats.today, period) : null),
    [stats, period],
  );

  const periods: { id: Period; label: string }[] = [
    { id: "week", label: t("app.stats.periods.week") },
    { id: "month", label: t("app.stats.periods.month") },
    { id: "all", label: t("app.stats.periods.all") },
  ];
  const chartTitle = {
    day: t("app.stats.perDay"),
    week: t("app.stats.perWeek"),
    month: t("app.stats.perMonth"),
  }[series?.bucket ?? "day"];

  return (
    <div
      ref={rootRef}
      className="j-layer j-stats"
      aria-label={t("app.stats.title")}
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
        <h2 className="j-title">{t("app.stats.title")}</h2>
        {stats && !empty && (
          <>
            <span
              className={`j-chip ${stats.streak > 0 ? "red" : ""}`}
              title={t("app.stats.streakHint")}
            >
              <Flame size={14} aria-hidden="true" />
              <span className="j-num">
                {t("app.stats.streak", {
                  count: stats.streak,
                  formatted: nf.format(stats.streak),
                })}
              </span>
            </span>
            <div
              className="j-seg"
              role="radiogroup"
              aria-label={t("app.stats.periods.label")}
            >
              {periods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={period === p.id}
                  onClick={() => setPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="j-st-body j-scroll">
        {stats === null ? null : empty ? (
          <Empty />
        ) : (
          totals &&
          series && (
            <>
              <div className="j-st-tiles">
                <Tile
                  label={t("app.stats.words")}
                  value={nf.format(totals.words)}
                />
                <Tile
                  label={t("app.stats.timeSaved")}
                  value={formatDuration(totals.minutes_saved, t)}
                  sub={t("app.stats.timeSavedHint")}
                />
                <Tile
                  label={t("app.stats.speed")}
                  value={nf.format(totals.words_per_minute)}
                  sub={t("app.stats.speedUnit")}
                />
                <Tile
                  label={t("app.stats.dictations")}
                  value={nf.format(totals.dictations)}
                />
              </div>
              <div className="j-st-row">
                <section className="j-st-card chart">
                  <h3 className="j-st-h">
                    <ChartColumn size={15} aria-hidden="true" />
                    {chartTitle}
                  </h3>
                  <WordsChart
                    bars={series.bars}
                    bucket={series.bucket}
                    weekdays={period === "week"}
                  />
                </section>
                <section className="j-st-card">
                  <h3 className="j-st-h">{t("app.stats.where")}</h3>
                  <AppsList apps={totals.apps} />
                </section>
              </div>
            </>
          )
        )}
      </div>

      <div className="j-h-foot">
        <span>{t("app.stats.private")}</span>
        {stats && !empty && (
          <button
            type="button"
            className="j-btn ghost sm"
            onClick={() => setConfirmOpen(true)}
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t("app.stats.reset")}
          </button>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        title={t("app.stats.resetTitle")}
        closeLabel={t("common.close")}
        onOpenChange={setConfirmOpen}
        footer={
          <>
            <button
              type="button"
              className="j-btn sm"
              onClick={() => setConfirmOpen(false)}
            >
              {t("app.stats.cancel")}
            </button>
            <button
              type="button"
              className="j-btn sm primary"
              onClick={() => void reset()}
            >
              {t("app.stats.resetConfirm")}
            </button>
          </>
        }
      >
        <p className="text-sm m-0">{t("app.stats.resetText")}</p>
      </Dialog>
    </div>
  );
};

export default StatsView;
