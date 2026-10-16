import React from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { Slider } from "../ui/Slider";
import { useSettings } from "../../hooks/useSettings";
import { useSettingsStore } from "../../stores/settingsStore";

export const VolumeSlider: React.FC<{ disabled?: boolean }> = ({
  disabled = false,
}) => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const playTestSound = useSettingsStore((state) => state.playTestSound);
  const audioFeedbackVolume = getSetting("audio_feedback_volume") ?? 0.5;
  const percent = new Intl.NumberFormat(i18n.language, { style: "percent" });

  return (
    <Slider
      value={audioFeedbackVolume}
      onChange={(value: number) =>
        updateSetting("audio_feedback_volume", value)
      }
      min={0}
      max={1}
      label={t("settings.sound.volume.title")}
      description=""
      formatValue={(value) => percent.format(value)}
      disabled={disabled}
      extra={
        <button
          type="button"
          className="j-ibtn sm"
          disabled={disabled}
          title={t("app.settings.playSound")}
          aria-label={t("app.settings.playSound")}
          onClick={async () => {
            await playTestSound("start");
            await playTestSound("stop");
          }}
        >
          <Play size={16} aria-hidden="true" />
        </button>
      }
    />
  );
};
