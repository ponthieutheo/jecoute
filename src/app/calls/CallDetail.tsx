import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Check,
  Copy,
  FileDown,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { commands, type Call, type CallsState } from "@/bindings";
import { copyToClipboard } from "@/components/settings/history/clipboard";
import { useNavigationStore } from "@/stores/navigationStore";
import {
  callMarkdown,
  clock,
  initial,
  minutes,
  speakerColor,
  speakerOf,
} from "./callText";

/** Un champ qui remplace un texte le temps de le renommer. */
const InlineEdit: React.FC<{
  value: string;
  label: string;
  className?: string;
  onDone: (value: string | null) => void;
}> = ({ value, label, className, onDone }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value);
  const done = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(save && text.trim() && text.trim() !== value ? text.trim() : null);
  };
  return (
    <input
      ref={ref}
      className={`j-c-edit ${className ?? ""}`}
      value={text}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(true);
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(true)}
    />
  );
};

const Transcript: React.FC<{ call: Call; live?: boolean }> = ({
  call,
  live,
}) => {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement>(null);
  const count = call.lines.length;
  // En direct : on suit les nouvelles lignes.
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [live, count]);
  if (count === 0) {
    return (
      <p className="j-c-empty">
        {live ? t("app.calls.liveEmpty") : t("app.calls.nobody")}
      </p>
    );
  }
  return (
    <div className="j-c-lines j-selectable">
      {call.lines.map((line, index) => {
        const who = speakerOf(call, line, t);
        return (
          <div className="j-c-line" key={line.id ?? index}>
            <span className="ts j-num">{clock(line.start)}</span>
            <div>
              <b style={{ color: speakerColor(who.color) }}>{who.name}</b>
              <p>{line.text}</p>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};

const Summary: React.FC<{
  call: Call;
  state: CallsState;
  busy: boolean;
}> = ({ call, state, busy }) => {
  const { t } = useTranslation();
  const openSettings = useNavigationStore((s) => s.openSettings);
  const hasNotes =
    !!call.summary || call.key_points.length > 0 || call.todos.length > 0;
  const provider = state.summary.provider;

  if (busy) {
    return (
      <p className="j-c-empty j-c-pulse">{t("app.calls.summaryWriting")}</p>
    );
  }
  if (!hasNotes) {
    if (!state.summary.ready) {
      return (
        <div className="j-c-setup">
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <b>{t("app.calls.noProviderTitle")}</b>
            <p>{t("app.calls.noProviderDesc")}</p>
            <button
              type="button"
              className="j-btn sm"
              onClick={() => openSettings("text")}
            >
              {t("app.calls.openTextSettings")}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="j-c-setup">
        <Sparkles size={18} aria-hidden="true" />
        <div>
          <b>
            {call.summary_error
              ? t("app.calls.summaryFailed")
              : t("app.calls.noSummary")}
          </b>
          {call.summary_error && (
            <p className="j-c-err" title={call.summary_error}>
              {call.summary_error}
            </p>
          )}
          <p>{t("app.calls.summarySent", { provider })}</p>
          <button
            type="button"
            className="j-btn sm primary"
            onClick={() => void commands.callSummarize(call.id)}
          >
            {t("app.calls.writeSummary")}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="j-c-summary">
      {call.summary && <p className="j-c-sum j-selectable">{call.summary}</p>}
      {call.key_points.length > 0 && (
        <section>
          <h3 className="j-c-h">{t("app.calls.keyPoints")}</h3>
          <ul className="j-c-points j-selectable">
            {call.key_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}
      {call.todos.length > 0 && (
        <section>
          <h3 className="j-c-h">{t("app.calls.todos")}</h3>
          <div className="j-c-todos">
            {call.todos.map((todo, i) => {
              const extra = [todo.owner, todo.due].filter(Boolean).join(" · ");
              return (
                <label
                  key={todo.id ?? i}
                  className={`j-c-todo ${todo.done ? "done" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={!!todo.done}
                    onChange={() =>
                      todo.id && void commands.callToggleTodo(call.id, todo.id)
                    }
                  />
                  <span>
                    <span className="tx">{todo.text}</span>
                    {extra && <span className="who">{extra}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      )}
      <div className="j-c-again">
        {call.summary_error && (
          <span className="j-c-err" title={call.summary_error}>
            {t("app.calls.summaryFailed")}
          </span>
        )}
        <button
          type="button"
          className="j-btn ghost sm"
          disabled={!state.summary.ready}
          onClick={() => void commands.callSummarize(call.id)}
        >
          <RotateCcw size={14} aria-hidden="true" />
          {t("app.calls.writeSummaryAgain")}
        </button>
      </div>
    </div>
  );
};

/** Raison d'un échec, en phrase. */
const failureText = (error: string | null, t: (k: string) => string) => {
  if (error === "audio-gone") return t("app.calls.errors.audioGone");
  if (error === "no-model") return t("app.calls.errors.noModel");
  return error ?? "";
};

export const CallDetail: React.FC<{ call: Call; state: CallsState }> = ({
  call,
  state,
}) => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<"summary" | "transcript">("summary");
  const [renaming, setRenaming] = useState(false);
  const [renamingSpeaker, setRenamingSpeaker] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  const work = state.working.find((w) => w.id === call.id);
  const recording = call.status === "recording";
  const writing =
    call.status === "processing" || (work?.step === "transcript" && !!work);
  const summarizing = work?.step === "summary";

  useEffect(() => {
    setConfirmDelete(false);
    setRenaming(false);
    setRenamingSpeaker(null);
  }, [call.id]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const when = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(call.started_at));
  const meta = [
    when,
    recording
      ? clock((now - call.started_at) / 1000)
      : t("app.calls.minutes", { count: minutes(call) }),
    call.system_audio ? t("app.calls.withSystem") : t("app.calls.micOnly"),
  ].join(" · ");

  const copy = async () => {
    const ok = await copyToClipboard(callMarkdown(call, t, i18n.language));
    if (!ok) {
      toast.error(t("app.calls.copyError"));
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const exportMd = async () => {
    const result = await commands.callExport(
      call.id,
      callMarkdown(call, t, i18n.language),
    );
    if (result.status === "ok") toast(t("app.calls.exported", { path: result.data }));
    else toast.error(t("app.calls.exportError"));
  };

  const remove = async () => {
    const result = await commands.callDelete(call.id);
    if (result.status !== "ok") toast.error(t("app.calls.deleteError"));
    setConfirmDelete(false);
  };

  let body: React.ReactNode;
  if (recording) {
    body = (
      <>
        <div className="j-c-live">
          <span className="j-dot rec" aria-hidden="true" />
          <b>{t("app.calls.live")}</b>
          <span className="j-muted">{t("app.calls.liveHint")}</span>
        </div>
        <Transcript call={call} live />
      </>
    );
  } else if (writing) {
    const percent = Math.round((work?.fraction ?? 0) * 100);
    body = (
      <div className="j-c-writing">
        <p>{t("app.calls.writing")}</p>
        <div
          className="j-bar"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("app.calls.writing")}
        >
          <b style={{ width: `${Math.max(3, percent)}%` }} />
        </div>
        <span className="j-small j-num">{percent} %</span>
      </div>
    );
  } else if (call.status === "failed") {
    body = (
      <div className="j-c-setup warn">
        <div>
          <b>{t("app.calls.failed")}</b>
          <p className="j-c-err">{failureText(call.error, t)}</p>
          {call.error !== "audio-gone" && (
            <button
              type="button"
              className="j-btn sm"
              onClick={() => void commands.callRetry(call.id)}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t("app.calls.retry")}
            </button>
          )}
        </div>
      </div>
    );
  } else if (call.lines.length === 0) {
    body = <p className="j-c-empty">{t("app.calls.nobody")}</p>;
  } else {
    body = (
      <>
        <div
          className="j-seg sm j-c-tabs"
          role="radiogroup"
          aria-label={t("app.calls.view")}
        >
          <button
            type="button"
            role="radio"
            aria-checked={tab === "summary"}
            onClick={() => setTab("summary")}
          >
            {t("app.calls.summary")}
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={tab === "transcript"}
            onClick={() => setTab("transcript")}
          >
            {t("app.calls.transcript")}
          </button>
        </div>
        {tab === "summary" ? (
          <Summary call={call} state={state} busy={summarizing} />
        ) : (
          <Transcript call={call} />
        )}
      </>
    );
  }

  const ready = call.status === "ready";

  return (
    <div className="j-c-detail">
      <div className="j-c-title">
        {renaming ? (
          <InlineEdit
            value={call.title}
            label={t("app.calls.rename")}
            className="title"
            onDone={(title) => {
              setRenaming(false);
              if (title) void commands.callRename(call.id, title);
            }}
          />
        ) : (
          <h2
            className="j-title"
            title={t("app.calls.rename")}
            onClick={() => setRenaming(true)}
          >
            {call.title}
          </h2>
        )}
        <p className="j-small">{meta}</p>
      </div>

      {/* Pendant l'appel, le bouton « Arrêter » est dans l'en-tête de la page. */}
      <div className="j-c-tools">
        {!recording && (
          <>
            {ready && (
              <>
                <button type="button" className="j-btn sm" onClick={copy}>
                  {copied ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                  {copied ? t("app.home.copied") : t("app.calls.copy")}
                </button>
                <button type="button" className="j-btn sm" onClick={exportMd}>
                  <FileDown size={14} aria-hidden="true" />
                  {t("app.calls.export")}
                </button>
              </>
            )}
            {!writing && !summarizing && (
              <button
                type="button"
                className="j-ibtn sm"
                aria-label={t("app.calls.delete")}
                title={t("app.calls.delete")}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>

      {confirmDelete && (
        <div className="j-notice warn j-c-confirm" role="alert">
          <p>{t("app.calls.deleteConfirm")}</p>
          <button type="button" className="j-btn sm" onClick={() => setConfirmDelete(false)}>
            {t("app.calls.cancel")}
          </button>
          <button type="button" className="j-btn sm primary" onClick={remove}>
            {t("app.calls.delete")}
          </button>
        </div>
      )}

      {ready && call.speakers.length > 0 && (
        <div className="j-c-people" aria-label={t("app.calls.people")}>
          {call.speakers.map((s) =>
            renamingSpeaker === s.id ? (
              <InlineEdit
                key={s.id}
                value={s.name}
                label={t("app.calls.renameSpeaker")}
                className="person"
                onDone={(name) => {
                  setRenamingSpeaker(null);
                  if (name) void commands.callRenameSpeaker(call.id, s.id, name);
                }}
              />
            ) : (
              <button
                key={s.id}
                type="button"
                className="j-c-person"
                title={t("app.calls.renameSpeaker")}
                onClick={() => setRenamingSpeaker(s.id)}
              >
                <span
                  className="av"
                  style={{ background: speakerColor(s.color) }}
                  aria-hidden="true"
                >
                  {initial(s)}
                </span>
                {s.name}
              </button>
            ),
          )}
        </div>
      )}

      <div className="j-c-body">{body}</div>
    </div>
  );
};

export default CallDetail;
