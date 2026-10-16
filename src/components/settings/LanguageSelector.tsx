import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { SettingContainer } from "../ui/SettingContainer";
import { ResetButton } from "../ui/ResetButton";
import { useSettings } from "../../hooks/useSettings";
import { useSystemLanguage } from "../../hooks/useSystemLanguage";
import {
  getLanguageLabel,
  LANGUAGES,
  recognitionLanguage,
  supportsLanguageCode,
} from "../../lib/constants/languages";

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
const effectiveLanguage = (
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

// A language's name in the interface language ("fr" → "Français" in French),
// falling back to the English label when the runtime doesn't know the code.
const localizedLanguageName = (code: string, uiLanguage: string): string => {
  const base = recognitionLanguage(code);
  const fallback = getLanguageLabel(code) ?? code;
  try {
    const name = new Intl.DisplayNames([uiLanguage], { type: "language" }).of(
      base,
    );
    if (!name || name.toLowerCase() === base) return fallback;
    return name.charAt(0).toLocaleUpperCase(uiLanguage) + name.slice(1);
  } catch {
    return fallback;
  }
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  descriptionMode = "tooltip",
  grouped = false,
  supportedLanguages,
  supportsLanguageDetection = true,
}) => {
  const { t, i18n } = useTranslation();
  const { getSetting, updateSetting, resetSetting, isUpdating } = useSettings();
  const systemLanguage = useSystemLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // The persisted *intent* (auto | code). What's actually used/shown is the
  // effective value resolved against the current model's capabilities.
  const intent = getSetting("selected_language") || "auto";
  const selectedLanguage = effectiveLanguage(
    intent,
    supportedLanguages ?? [],
    supportsLanguageDetection,
    systemLanguage,
  );

  // What "Auto" means for this model: real detection, or the concrete
  // fallback for a model that can't detect, shown as "Auto (French)".
  const autoLanguage = effectiveLanguage(
    "auto",
    supportedLanguages ?? [],
    supportsLanguageDetection,
    systemLanguage,
  );
  const autoLabel =
    autoLanguage === "auto"
      ? t("settings.general.language.auto")
      : t("settings.general.language.autoWithLanguage", {
          language: localizedLanguageName(autoLanguage, i18n.language),
        });
  const languageLabel = (language: { value: string; label: string }) =>
    language.value === "auto" ? autoLabel : language.label;
  // "Auto" stays highlighted while it is the user's choice, even when it
  // resolves to a concrete language.
  const highlightedLanguage = intent === "auto" ? "auto" : selectedLanguage;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const availableLanguages = useMemo(() => {
    if (!supportedLanguages || supportedLanguages.length === 0)
      return LANGUAGES;
    return LANGUAGES.filter(
      (lang) =>
        lang.value === "auto" ||
        supportsLanguageCode(supportedLanguages, lang.value),
    );
  }, [supportedLanguages]);

  const filteredLanguages = availableLanguages.filter((language) =>
    languageLabel(language).toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedLanguageName =
    highlightedLanguage === "auto"
      ? autoLabel
      : getLanguageLabel(selectedLanguage) || autoLabel;

  const handleLanguageSelect = async (languageCode: string) => {
    await updateSetting("selected_language", languageCode);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleReset = async () => {
    await resetSetting("selected_language");
  };

  const handleToggle = () => {
    if (isUpdating("selected_language")) return;
    setIsOpen(!isOpen);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && filteredLanguages.length > 0) {
      // Select first filtered language on Enter
      handleLanguageSelect(filteredLanguages[0].value);
    } else if (event.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <SettingContainer
      title={t("settings.general.language.title")}
      description={t("settings.general.language.description")}
      descriptionMode={descriptionMode}
      grouped={grouped}
    >
      <div className="flex items-center space-x-1">
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            className={`px-2 py-1 text-sm font-semibold bg-mid-gray/10 border border-mid-gray/80 rounded min-w-[200px] text-start flex items-center justify-between transition-all duration-150 ${
              isUpdating("selected_language")
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-mid-gray/10 cursor-pointer hover:border-accent"
            }`}
            onClick={handleToggle}
            disabled={isUpdating("selected_language")}
          >
            <span className="truncate">{selectedLanguageName}</span>
            <svg
              className={`w-4 h-4 ms-2 transition-transform duration-200 ${
                isOpen ? "transform rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isOpen && !isUpdating("selected_language") && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-mid-gray/80 rounded shadow-lg z-50 max-h-60 overflow-hidden">
              {/* Search input */}
              <div className="p-2 border-b border-mid-gray/80">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyDown={handleKeyDown}
                  placeholder={t("settings.general.language.searchPlaceholder")}
                  className="w-full px-2 py-1 text-sm bg-mid-gray/10 border border-mid-gray/40 rounded focus:outline-none focus:ring-1 focus:ring-logo-primary focus:border-logo-primary"
                />
              </div>

              <div className="max-h-48 overflow-y-auto">
                {filteredLanguages.length === 0 ? (
                  <div className="px-2 py-2 text-sm text-mid-gray text-center">
                    {t("settings.general.language.noResults")}
                  </div>
                ) : (
                  filteredLanguages.map((language) => (
                    <button
                      key={language.value}
                      type="button"
                      className={`w-full px-2 py-1 text-sm text-start hover:bg-mid-gray/10 transition-colors duration-150 ${
                        highlightedLanguage === language.value
                          ? "bg-mid-gray/15 text-accent-text font-semibold"
                          : ""
                      }`}
                      onClick={() => handleLanguageSelect(language.value)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">
                          {languageLabel(language)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <ResetButton
          onClick={handleReset}
          disabled={isUpdating("selected_language")}
        />
      </div>
      {isUpdating("selected_language") && (
        <div className="absolute inset-0 bg-mid-gray/10 rounded flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-logo-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </SettingContainer>
  );
};
