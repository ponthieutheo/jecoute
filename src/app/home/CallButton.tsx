import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Phone } from "lucide-react";
import { useCallsStore } from "@/stores/callsStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { clock } from "../calls/callText";

/** Les secondes écoulées depuis `since`, mises à jour chaque seconde. */
export const useElapsed = (since: number | null): number => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [since]);
  return since === null ? 0 : Math.max(0, (now - since) / 1000);
};

/** Le bouton « Appels » de l'accueil ; pendant un appel, le chrono en rouge. */
export const CallButton: React.FC = () => {
  const { t } = useTranslation();
  const openCalls = useNavigationStore((s) => s.openCalls);
  const recording = useCallsStore((s) => s.state?.recording ?? null);
  const elapsed = useElapsed(recording?.started_at ?? null);

  if (recording) {
    return (
      <button
        type="button"
        className="j-btn ghost sm j-call-pill"
        onClick={openCalls}
        title={t("app.home.callRecording")}
      >
        <span className="j-dot rec" aria-hidden="true" />
        <span className="j-num">
          {t("app.home.callTime", { time: clock(elapsed) })}
        </span>
      </button>
    );
  }
  return (
    <button type="button" className="j-btn ghost sm" onClick={openCalls}>
      <Phone size={16} aria-hidden="true" />
      {t("app.home.calls")}
    </button>
  );
};

export default CallButton;
