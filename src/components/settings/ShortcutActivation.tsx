import React from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "../../hooks/useSettings";
import type { ShortcutActivation } from "@/bindings";

interface ShortcutActivationProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const MODES: { value: ShortcutActivation; option: string; key: string }[] = [
  { value: "hold_or_toggle", option: "holdOrToggle", key: "hold_or_toggle" },
  { value: "push_to_talk", option: "pushToTalk", key: "push_to_talk" },
  { value: "toggle", option: "toggle", key: "toggle" },
];

/** Comportement du raccourci : segments, la description suit le choix. */
export const ShortcutActivationSetting: React.FC<ShortcutActivationProps> =
  React.memo(() => {
    const { t } = useTranslation();
    const { getSetting, updateSetting, isUpdating } = useSettings();
    const selected = (getSetting("shortcut_activation") ||
      "hold_or_toggle") as ShortcutActivation;
    const current = MODES.find((m) => m.value === selected) ?? MODES[0];
    const busy = isUpdating("shortcut_activation");

    return (
      <SettingContainer
        title={t("settings.general.shortcutActivation.title")}
        description={t(
          `settings.general.shortcutActivation.descriptions.${current.key}`,
        )}
        layout="stacked"
      >
        <div
          className="j-seg"
          role="radiogroup"
          aria-label={t("settings.general.shortcutActivation.title")}
        >
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={selected === mode.value}
              disabled={busy}
              onClick={() => updateSetting("shortcut_activation", mode.value)}
            >
              {t(`settings.general.shortcutActivation.options.${mode.option}`)}
            </button>
          ))}
        </div>
      </SettingContainer>
    );
  });
