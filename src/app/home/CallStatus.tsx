import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Square } from "lucide-react";
import { useCallsStore } from "@/stores/callsStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { clock, speakerOf } from "../calls/callText";
import type { DotKind } from "../hooks/useHomeState";
import { useElapsed } from "./CallButton";

/**
 * Sous le perso pendant un appel : le chrono, la dernière phrase entendue
 * (transcription en direct) et de quoi arrêter.
 */
export const CallStatus: React.FC<{ dot: DotKind }> = ({ dot }) => {
  const { t } = useTranslation();
  const recording = useCallsStore((s) => s.state?.recording ?? null);
  const live = useCallsStore((s) =>
    s.live && s.live.id === s.state?.recording?.id ? s.live : null,
  );
  const stop = useCallsStore((s) => s.stop);
  const openCalls = useNavigationStore((s) => s.openCalls);
  const elapsed = useElapsed(recording?.started_at ?? null);
  const [stopping, setStopping] = useState(false);

  const last = live?.lines[live.lines.length - 1];
  const who = live && last ? speakerOf(live, last, t) : null;

  return (
    <div className="j-status" aria-live="polite">
      <div className="j-st-title">
        <span className={`j-dot ${dot}`} aria-hidden="true" />
        <span className="j-st-text full j-num">
          {t("app.status.call.title", { time: clock(elapsed) })}
        </span>
        <span className="j-st-text short j-num">{clock(elapsed)}</span>
      </div>
      <p className="j-st-desc j-call-live">
        {last && who ? (
          <>
            <b>{t("app.status.call.said", { name: who.name })}</b> {last.text}
          </>
        ) : recording?.device_lost ? (
          t("app.status.call.deviceLost")
        ) : recording?.system_audio ? (
          t("app.status.call.desc")
        ) : (
          t("app.status.call.descMicOnly")
        )}
      </p>
      <div className="j-st-chips">
        <button
          type="button"
          className="j-btn sm primary"
          disabled={stopping}
          onClick={async () => {
            setStopping(true);
            await stop();
            setStopping(false);
          }}
        >
          <Square size={12} fill="currentColor" aria-hidden="true" />
          {t("app.calls.stop")}
        </button>
        <button type="button" className="j-btn sm" onClick={openCalls}>
          {t("app.status.call.open")}
        </button>
      </div>
    </div>
  );
};

export default CallStatus;
