import React from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { useSettings } from "@/hooks/useSettings";
import { applyTheme, THEME_OPTIONS } from "@/lib/utils/theme";
import type { Theme } from "@/bindings";

interface ThemeSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/** Apparence : Système, Clair ou Sombre, en segments. */
export const ThemeSelector: React.FC<ThemeSelectorProps> = React.memo(() => {
  const { t } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const currentTheme: Theme = settings?.theme ?? "system";

  const handleThemeChange = (theme: Theme) => {
    applyTheme(theme);
    updateSetting("theme", theme);
  };

  return (
    <SettingContainer title={t("theme.title")} description="">
      <div className="j-seg" role="radiogroup" aria-label={t("theme.title")}>
        {THEME_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={currentTheme === value}
            onClick={() => handleThemeChange(value)}
          >
            {t(`theme.options.${value}`)}
          </button>
        ))}
      </div>
    </SettingContainer>
  );
});

ThemeSelector.displayName = "ThemeSelector";
