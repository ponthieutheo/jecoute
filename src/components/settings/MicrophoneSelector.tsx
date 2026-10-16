import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { MicLevel } from "@/app/settings/MicLevel";
import { useSettings } from "../../hooks/useSettings";

interface MicrophoneSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const MicrophoneSelector: React.FC<MicrophoneSelectorProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const {
      getSetting,
      updateSetting,
      isUpdating,
      isLoading,
      audioDevices,
      refreshAudioDevices,
    } = useSettings();

    const selectedMicrophone =
      getSetting("selected_microphone") === "default"
        ? "Default"
        : getSetting("selected_microphone") || "Default";

    const handleMicrophoneSelect = async (deviceName: string) => {
      await updateSetting("selected_microphone", deviceName);
    };

    // « Default » suit le micro par défaut du système (et remplace l'ancien
    // bouton de réinitialisation).
    const microphoneOptions = audioDevices.map((device) => ({
      value: device.name,
      label:
        device.name === "Default"
          ? t("app.settings.systemDefault")
          : device.name,
    }));

    return (
      <SettingContainer
        title={t("settings.sound.microphone.title")}
        description=""
        layout="stacked"
      >
        <Dropdown
          options={microphoneOptions}
          selectedValue={selectedMicrophone}
          onSelect={handleMicrophoneSelect}
          placeholder={
            isLoading || audioDevices.length === 0
              ? t("settings.sound.microphone.loading")
              : t("settings.sound.microphone.placeholder")
          }
          disabled={
            isUpdating("selected_microphone") ||
            isLoading ||
            audioDevices.length === 0
          }
          onRefresh={refreshAudioDevices}
          ariaLabel={t("settings.sound.microphone.title")}
          fullWidth
        />
        <MicLevel />
      </SettingContainer>
    );
  },
);
