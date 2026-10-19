import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, Info, Settings2, Sparkles, Users } from "lucide-react";
import { commands, type CallListItem, type CallsState } from "@/bindings";
import { useCallsStore } from "@/stores/callsStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Switch } from "@/components/ui/ToggleSwitch";
import { useInert } from "../hooks/useInert";
import { Popover } from "../ui/Popover";
import { dayKey, formatDay, formatTime, formatSize } from "../lib/format";
import { CallDetail } from "./CallDetail";
import { clock, minutes } from "./callText";

/** Les erreurs du démarrage, en phrases. */
const startErrorKey = (code: string) => {
  switch (code) {
    case "no-model":
      return "app.calls.errors.noModel";
    case "mic":
      return "app.calls.errors.mic";
    case "busy":
      return "app.calls.errors.busy";
    default:
      return null;
  }
};

/** Bouton « Enregistrer un appel » / « Arrêter · 3:12 ». */
const RecordButton: React.FC<{ state: CallsState | null }> = ({ state }) => {
  const { t } = useTranslation();
  const start = useCallsStore((s) => s.start);
  const stop = useCallsStore((s) => s.stop);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const recording = state?.recording ?? null;

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  if (recording) {
    return (
      <button
        type="button"
        className="j-btn sm primary j-c-rec"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await stop();
          setBusy(false);
        }}
      >
        <span className="j-c-stopdot" aria-hidden="true" />
        {t("app.calls.stopWithTime", {
          time: clock((now - recording.started_at) / 1000),
        })}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="j-btn sm primary j-c-rec"
      disabled={busy || !state}
      onClick={async () => {
        setBusy(true);
        await start();
        setBusy(false);
      }}
    >
      <span className="j-c-recdot" aria-hidden="true" />
      {busy ? t("app.calls.starting") : t("app.calls.record")}
    </button>
  );
};

/** Les réglages des appels, dans un panneau flottant. */
const CallSettings: React.FC<{ state: CallsState }> = ({ state }) => {
  const { t, i18n } = useTranslation();
  const openSettings = useNavigationStore((s) => s.openSettings);
  const vs = state.voice_separation;
  const set = (option: "system_audio" | "voice_separation" | "summary", enabled: boolean) =>
    void commands.callsSetOption(option, enabled);

  return (
    <div className="j-c-settings">
      <div className="j-c-set">
        <div>
          <b>{t("app.calls.settings.system")}</b>
          <p>{t("app.calls.settings.systemDesc")}</p>
        </div>
        <Switch
          checked={state.system_audio}
          label={t("app.calls.settings.system")}
          onChange={(v) => set("system_audio", v)}
        />
      </div>
      <div className="j-c-set">
        <div>
          <b>{t("app.calls.settings.voices")}</b>
          <p>
            {vs.state === "ready"
              ? t("app.calls.settings.voicesReady")
              : t("app.calls.settings.voicesDesc", {
                  size: formatSize(vs.size_mb, i18n.language, t),
                })}
          </p>
          {vs.enabled && vs.state !== "ready" && <VoiceDownload state={state} compact />}
        </div>
        <Switch
          checked={vs.enabled}
          label={t("app.calls.settings.voices")}
          onChange={(v) => set("voice_separation", v)}
        />
      </div>
      <div className="j-c-set">
        <div>
          <b>{t("app.calls.settings.summary")}</b>
          <p>
            {state.summary.ready
              ? t("app.calls.settings.summaryReady", {
                  provider: state.summary.provider,
                  model: state.summary.model,
                })
              : t("app.calls.settings.summaryMissing")}
            {state.summary.ready && !state.summary.local && (
              <> {t("app.calls.summaryRemote")}</>
            )}
          </p>
          {!state.summary.ready && (
            <button
              type="button"
              className="j-link"
              onClick={() => openSettings("text")}
            >
              {t("app.calls.openTextSettings")}
            </button>
          )}
        </div>
        <Switch
          checked={state.summary.enabled}
          label={t("app.calls.settings.summary")}
          onChange={(v) => set("summary", v)}
        />
      </div>
      <p className="j-small j-c-set-foot">
        {t("app.calls.settings.mic")}{" "}
        <button
          type="button"
          className="j-link"
          onClick={() => openSettings("sound", "microphone")}
        >
          {t("app.calls.settings.micLink")}
        </button>
      </p>
    </div>
  );
};

/** Téléchargement du séparateur de voix (une fois, ~30 Mo). */
const VoiceDownload: React.FC<{ state: CallsState; compact?: boolean }> = ({
  state,
  compact,
}) => {
  const { t } = useTranslation();
  const vs = state.voice_separation;
  if (vs.state === "downloading") {
    const percent = Math.round(vs.fraction * 100);
    return (
      <div className="j-c-dl">
        <div
          className="j-bar"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("app.calls.voices.downloading")}
        >
          <b style={{ width: `${percent}%` }} />
        </div>
        <span className="j-small j-num">{percent} %</span>
      </div>
    );
  }
  return (
    <div className="j-c-dl">
      <button
        type="button"
        className={`j-btn sm ${compact ? "" : "primary"}`}
        onClick={() => void commands.callsDownloadVoiceSeparation()}
      >
        <Download size={14} aria-hidden="true" />
        {vs.state === "failed" ? t("app.calls.voices.retry") : t("app.calls.voices.download")}
      </button>
      {vs.state === "failed" && vs.error && (
        <span className="j-small j-c-err" title={vs.error}>
          {t("app.calls.voices.failed")}
        </span>
      )}
    </div>
  );
};

const CallItem: React.FC<{
  call: CallListItem;
  selected: boolean;
  working: boolean;
  onSelect: () => void;
}> = ({ call, selected, working, onSelect }) => {
  const { t, i18n } = useTranslation();
  let meta: React.ReactNode;
  if (call.status === "recording") {
    meta = (
      <>
        <span className="j-dot rec" aria-hidden="true" />
        {t("app.calls.recordingNow")}
      </>
    );
  } else if (call.status === "processing" || working) {
    meta = t("app.calls.writingShort");
  } else if (call.status === "failed") {
    meta = t("app.calls.failedShort");
  } else {
    meta = `${formatTime(call.started_at / 1000, i18n.language)} · ${t("app.calls.minutes", { count: minutes(call) })}`;
  }
  return (
    <button
      type="button"
      className={`j-c-item ${selected ? "on" : ""}`}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
    >
      <span className="t">{call.title}</span>
      <span className="m j-num">
        {meta}
        {call.open_todos > 0 && call.status === "ready" && (
          <span className="j-chip ia">
            {t("app.calls.openTodos", { count: call.open_todos })}
          </span>
        )}
      </span>
    </button>
  );
};

/** La page « Appels » : l'enregistreur et les notes des appels. */
export const CallsView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isOpen = useNavigationStore((s) => s.callsOpen);
  const close = useNavigationStore((s) => s.closeCalls);
  const state = useCallsStore((s) => s.state);
  const selectedId = useCallsStore((s) => s.selectedId);
  const selected = useCallsStore((s) => s.selected);
  const select = useCallsStore((s) => s.select);
  const startError = useCallsStore((s) => s.startError);
  const clearStartError = useCallsStore((s) => s.clearStartError);
  const rootRef = useInert<HTMLDivElement>(!isOpen);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useSettingsStore((s) => s.settings);

  // Le fournisseur du résumé (et donc ce que dit le pied de page) se règle
  // ailleurs : relu à l'ouverture et à chaque changement de réglage.
  useEffect(() => {
    if (isOpen) void useCallsStore.getState().refresh();
  }, [isOpen, settings]);

  // Échap revient à l'accueil.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape" && !document.querySelector(".j-menu")) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  // À l'ouverture : l'appel en cours, sinon le dernier.
  useEffect(() => {
    if (!isOpen || !state) return;
    if (!selectedId) {
      const first = state.recording?.id ?? state.calls[0]?.id ?? null;
      if (first) void select(first);
    }
  }, [isOpen, state, selectedId, select]);

  const groups = useMemo(() => {
    const out: { key: number; label: string; items: CallListItem[] }[] = [];
    for (const call of state?.calls ?? []) {
      const key = dayKey(call.started_at / 1000);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(call);
      else
        out.push({
          key,
          label: formatDay(call.started_at / 1000, i18n.language, t),
          items: [call],
        });
    }
    return out;
  }, [state?.calls, i18n.language, t]);

  const errorKey = startError ? startErrorKey(startError) : null;
  const vs = state?.voice_separation;
  const showVoiceCard =
    !!vs && vs.enabled && vs.state !== "ready" && (state?.calls.length ?? 0) > 0;

  return (
    <div
      ref={rootRef}
      className="j-layer j-calls"
      aria-label={t("app.calls.title")}
    >
      <div className="j-h-head">
        <button
          type="button"
          className="j-ibtn"
          onClick={close}
          aria-label={t("app.history.back")}
          title={t("app.history.back")}
        >
          <ArrowLeft size={20} aria-hidden="true" className="rtl:-scale-x-100" />
        </button>
        <h2 className="j-title">{t("app.calls.title")}</h2>
        <button
          ref={settingsRef}
          type="button"
          className={`j-ibtn ${settingsOpen ? "on" : ""}`}
          aria-label={t("app.calls.settings.title")}
          title={t("app.calls.settings.title")}
          aria-expanded={settingsOpen}
          disabled={!state}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          <Settings2 size={18} aria-hidden="true" />
        </button>
        <RecordButton state={state} />
      </div>

      {(errorKey || startError) && (
        <div className="j-notice warn j-c-banner" role="alert">
          <Info size={16} className="ic" aria-hidden="true" />
          <p>{errorKey ? t(errorKey) : startError}</p>
          <button type="button" className="j-btn ghost sm" onClick={clearStartError}>
            {t("common.close")}
          </button>
        </div>
      )}

      <div className="j-c-main">
        <aside className="j-c-list j-scroll" aria-label={t("app.calls.list")}>
          {(state?.calls.length ?? 0) === 0 ? (
            <p className="j-c-none">{t("app.calls.emptyList")}</p>
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h3 className="j-day">{group.label}</h3>
                {group.items.map((call) => (
                  <CallItem
                    key={call.id}
                    call={call}
                    selected={call.id === selectedId}
                    working={!!state?.working.some((w) => w.id === call.id && w.step === "transcript")}
                    onSelect={() => void select(call.id)}
                  />
                ))}
              </section>
            ))
          )}
        </aside>

        <section className="j-c-pane j-scroll">
          {showVoiceCard && state && (
            <div className="j-c-setup j-c-voices">
              <Users size={18} aria-hidden="true" />
              <div>
                <b>{t("app.calls.voices.title")}</b>
                <p>
                  {t("app.calls.voices.desc", {
                    size: formatSize(state.voice_separation.size_mb, i18n.language, t),
                  })}
                </p>
                <VoiceDownload state={state} />
              </div>
            </div>
          )}
          {selected && state && selected.id === selectedId ? (
            <CallDetail call={selected} state={state} />
          ) : (
            <div className="j-c-welcome">
              <p className="j-section">{t("app.calls.welcomeTitle")}</p>
              <p>{t("app.calls.welcomeDesc")}</p>
            </div>
          )}
        </section>
      </div>

      <div className="j-h-foot j-c-foot">
        <span>
          <Info size={14} aria-hidden="true" />
          {t("app.calls.consent")}
        </span>
        {state?.summary.enabled && state.summary.ready && (
          <span className="j-c-sent">
            <Sparkles size={14} aria-hidden="true" />
            {t("app.calls.summarySent", { provider: state.summary.provider })}
            {!state.summary.local && ` ${t("app.calls.summaryRemote")}`}
          </span>
        )}
      </div>

      <Popover
        anchor={settingsRef.current}
        open={settingsOpen && !!state}
        onClose={() => setSettingsOpen(false)}
        align="end"
        matchWidth={false}
        width={340}
        maxHeight={460}
        aria-label={t("app.calls.settings.title")}
      >
        {state && <CallSettings state={state} />}
      </Popover>
    </div>
  );
};

export default CallsView;
