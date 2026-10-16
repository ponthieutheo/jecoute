import React from "react";
import { useTranslation } from "react-i18next";
import { MicrophoneSelector } from "@/components/settings/MicrophoneSelector";
import { ChannelSelector } from "@/components/settings/ChannelSelector";
import { MuteWhileRecording } from "@/components/settings/MuteWhileRecording";
import { AudioFeedback } from "@/components/settings/AudioFeedback";
import { VolumeSlider } from "@/components/settings/VolumeSlider";
import { SoundPicker } from "@/components/settings/SoundPicker";
import { OutputDeviceSelector } from "@/components/settings/OutputDeviceSelector";
import { useSettings } from "@/hooks/useSettings";

export const SoundTab: React.FC = () => {
  const { t } = useTranslation();
  const { audioFeedbackEnabled } = useSettings();

  return (
    <>
      <div data-focus-id="microphone">
        <MicrophoneSelector />
      </div>
      <ChannelSelector />
      <MuteWhileRecording />
      <AudioFeedback />
      <VolumeSlider disabled={!audioFeedbackEnabled} />
      <SoundPicker
        label={t("settings.debug.soundTheme.label")}
        description={t("settings.debug.soundTheme.description")}
        disabled={!audioFeedbackEnabled}
      />
      <OutputDeviceSelector disabled={!audioFeedbackEnabled} />
    </>
  );
};

export default SoundTab;
