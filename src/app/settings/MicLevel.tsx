import React from "react";
import { useTranslation } from "react-i18next";
import { useDictationStore } from "@/stores/dictationStore";

const BARS = 18;

/**
 * Niveau du micro pendant une dictée (événement « main-mic-level ») : pour
 * vérifier que le micro choisi entend bien.
 */
export const MicLevel: React.FC = () => {
  const { t } = useTranslation();
  const recording = useDictationStore((s) => s.state === "recording");
  const levels = useDictationStore((s) => s.levels);

  let level = 0;
  if (recording && levels && levels.length > 0) {
    let sum = 0;
    for (const v of levels) sum += Math.max(0, Math.min(1, v));
    level = sum / levels.length;
  }
  const on = Math.round(Math.min(1, level * 1.25) * BARS);

  return (
    <div className="j-mic-meter" aria-live="off">
      <div className="j-meter" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <i key={i} className={i < on ? "on" : ""} />
        ))}
      </div>
      <span>
        {recording
          ? t("app.settings.micLevelLive")
          : t("app.settings.micLevelHint")}
      </span>
    </div>
  );
};

export default MicLevel;
