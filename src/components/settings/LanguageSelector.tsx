import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { Dropdown, type DropdownOption } from "../ui/Dropdown";
import { useSettings } from "../../hooks/useSettings";
import { useSystemLanguage } from "../../hooks/useSystemLanguage";
import { useModelStore } from "../../stores/modelStore";
import {
  LANGUAGES,
  recognitionLanguage,
  supportsLanguageCode,
} from "../../lib/constants/languages";
import { languageName } from "@/app/lib/format";

interface LanguageSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
  supportedLanguages?: string[];
  // Whether the model can auto-detect language. Without detection, "Auto"
  // means the system language (or English) and its label names it.
  supportsLanguageDetection?: boolean;
}

// Mirrors the matching logic of `effective_language` in
// src-tauri/src/managers/model.rs. The Rust function is authoritative for the
// *concrete* code the engine receives (e.g. `nb`); this resolves the canonical
// picker intent (e.g. `no`) so model switches preserve the user's language.
// Model codes such as `en-US` and `nb` resolve to their `en` / `no` entry.
// A model that can't detect the language falls back to the system language,
// then English, then its first language.
export const effectiveLanguage = (
  intent: string,
  supported: string[],
  supportsDetection: boolean,
  systemLanguage: string | null,
): string => {
  if (supported.length === 0) return recognitionLanguage(intent);
  if (intent !== "auto" && supportsLanguageCode(supported, intent))
    return recognitionLanguage(intent);
  if (supportsDetection) return "auto";
  for (const fallback of [systemLanguage, "en"]) {
    if (fallback && supportsLanguageCode(supported, fallback))
      return recognitionLanguage(fallback);
  }
  return recognitionLanguage(supported[0]);
};

export interface RecognitionLanguage {
  /** Options du menu, noms dans la langue de l'interface. */
  options: DropdownOption[];
  /** Valeur mise en avant dans le menu (« auto » tant que c'est le choix). */
  highlighted: string;
  /** Libellé de la langue utilisée (« Français », « Automatique (Français) »). */
  label: string;
  /** Code effectivement transcrit, ou « auto » pour la détection. */
  effective: string;
  select: (code: string) => Promise<void>;
  reset: () => Promise<void>;
  isUpdating: boolean;
  /** Le modèle actif comprend plusieurs langues (le choix a un sens). */
  selectable: boolean;
}

/**
 * Langue parlée pour le modèle actif : partagée par la ligne des réglages et
 * la pastille de l'accueil.
 */
export const useRecognitionLanguage = (
  supportedLanguagesProp?: string[],
  supportsDetectionProp?: boolean,
): RecognitionLanguage => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting, resetSetting, isUpdating } = useSettings();
  const systemLanguage = useSystemLanguage();
  const { models, currentModel } = useModelStore();
  const model = models.find((m) => m.id === currentModel);
  const supported = supportedLanguagesProp ?? model?.supported_languages ?? [];
  const supportsDetection =
    supportsDetectionProp ?? model?.supports_language_detection ?? true;

  const intent = getSetting("selected_language") || "auto";
  const effective = effectiveLanguage(
    intent,
    supported,
    supportsDetection,
    systemLanguage,
  );
  const autoLanguage = effectiveLanguage(
    "auto",
    supported,
    supportsDetection,
    systemLanguage,
  );
  const ui = i18n.language;
  const autoLabel =
    autoLanguage === "auto"
      ? t("settings.general.language.auto")
      : t("settings.general.language.autoWithLanguage", {
          language: languageName(autoLanguage, ui),
        });
  const highlighted = intent === "auto" ? "auto" : effective;

  const options = useMemo<DropdownOption[]>(() => {
    const available =
      supported.length === 0
        ? LANGUAGES
        : LANGUAGES.filter(
            (lang) =>
              lang.value === "auto" ||
              supportsLanguageCode(supported, lang.value),
          );
    // Sans détection et avec une seule langue, « Auto » ne propose rien.
    return available.map((lang) => ({
      value: lang.value,
      label: lang.value === "auto" ? autoLabel : languageName(lang.value, ui),
    }));
  }, [supported, autoLabel, ui]);

  return {
    options,
    highlighted,
    label: highlighted === "auto" ? autoLabel : languageName(effective, ui),
    effective,
    select: async (code: string) => {
      await updateSetting("selected_language", code);
    },
    reset: async () => {
      await resetSetting("selected_language");
    },
    isUpdating: isUpdating("selected_language"),
    selectable: model?.supports_language_selection ?? supported.length > 1,
  };
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  supportedLanguages,
  supportsLanguageDetection = true,
}) => {
  const { t } = useTranslation();
  const language = useRecognitionLanguage(
    supportedLanguages,
    supportsLanguageDetection,
  );
  const count = Math.max(0, language.options.length - 1);

  return (
    <SettingContainer
      title={t("settings.general.language.title")}
      description={t("settings.general.language.description", { count })}
    >
      <Dropdown
        options={language.options}
        selectedValue={language.highlighted}
        onSelect={(code) => void language.select(code)}
        disabled={language.isUpdating}
        searchPlaceholder={t("settings.general.language.searchPlaceholder")}
        ariaLabel={t("settings.general.language.title")}
        menuClassName="right-0"
      />
    </SettingContainer>
  );
};
