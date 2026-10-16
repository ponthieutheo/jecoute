import React from "react";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { Dropdown, DropdownOption } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSettings } from "../../hooks/useSettings";

interface SoundPickerProps {
  label: string;
  description: string;
  disabled?: boolean;
}

export const SoundPicker: React.FC<SoundPickerProps> = ({
  label,
  description,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const playTestSound = useSettingsStore((state) => state.playTestSound);
  const customSounds = useSettingsStore((state) => state.customSounds);

  const selectedTheme = getSetting("sound_theme") ?? "marimba";

  const options: DropdownOption[] = [
    { value: "marimba", label: "Marimba" },
    { value: "pop", label: "Pop" },
  ];

  // Only add Custom option if both custom sound files exist
  if (customSounds.start && customSounds.stop) {
    options.push({ value: "custom", label: t("app.settings.customSound") });
  }

  const handlePlayBothSounds = async () => {
    await playTestSound("start");
    await playTestSound("stop");
  };

  return (
    <SettingContainer
      title={label}
      description={description}
      disabled={disabled}
    >
      <Dropdown
        selectedValue={selectedTheme}
        onSelect={(value) =>
          updateSetting("sound_theme", value as "marimba" | "pop" | "custom")
        }
        options={options}
        disabled={disabled}
        ariaLabel={label}
      />
      <button
        type="button"
        className="j-ibtn sm"
        onClick={handlePlayBothSounds}
        disabled={disabled}
        title={t("app.settings.playSound")}
        aria-label={t("app.settings.playSound")}
      >
        <Play size={16} aria-hidden="true" />
      </button>
    </SettingContainer>
  );
};
