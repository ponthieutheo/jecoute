import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
import { SettingContainer } from "../ui/SettingContainer";

interface CustomWordsProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

const normalizeCustomWord = (word: string) =>
  word
    .replace(/[<>"']/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Mots à reconnaître : étiquettes retirables et champ d'ajout. */
export const CustomWords: React.FC<CustomWordsProps> = React.memo(() => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const [newWord, setNewWord] = useState("");
  const customWords = getSetting("custom_words") || [];
  const normalizedWord = normalizeCustomWord(newWord);
  const busy = isUpdating("custom_words");

  const handleAddWord = () => {
    if (!normalizedWord || normalizedWord.length > 50) return;
    if (customWords.includes(normalizedWord)) {
      toast.error(
        t("settings.advanced.customWords.duplicate", { word: normalizedWord }),
      );
      return;
    }
    updateSetting("custom_words", [...customWords, normalizedWord]);
    setNewWord("");
  };

  const handleRemoveWord = (wordToRemove: string) => {
    updateSetting(
      "custom_words",
      customWords.filter((word) => word !== wordToRemove),
    );
  };

  return (
    <SettingContainer
      title={t("settings.advanced.customWords.title")}
      description={t("settings.advanced.customWords.description")}
      layout="stacked"
    >
      <div className="j-words">
        {customWords.map((word) => (
          <span className="j-word" key={word}>
            <span title={word}>{word}</span>
            <button
              type="button"
              onClick={() => handleRemoveWord(word)}
              disabled={busy}
              aria-label={t("settings.advanced.customWords.remove", { word })}
              title={t("settings.advanced.customWords.remove", { word })}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <label className="j-word-add">
          <Plus size={14} aria-hidden="true" />
          <input
            value={newWord}
            maxLength={50}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddWord();
              }
            }}
            onBlur={() => {
              if (normalizedWord) handleAddWord();
            }}
            placeholder={t("settings.advanced.customWords.placeholder")}
            aria-label={t("settings.advanced.customWords.placeholder")}
            disabled={busy}
          />
        </label>
      </div>
    </SettingContainer>
  );
});
