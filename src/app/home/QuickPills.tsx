import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cpu, Download, Globe, List } from "lucide-react";
import { useModelStore } from "@/stores/modelStore";
import { useModelStatusStore } from "@/stores/modelStatusStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useRecognitionLanguage } from "@/components/settings/LanguageSelector";
import { Popover } from "../ui/Popover";
import { OptionList } from "../ui/OptionList";
import { modelName } from "../lib/modelText";

/** Pastilles de l'accueil : modèle actif et langue parlée, modifiables sur place. */
export const QuickPills: React.FC = () => {
  const { t } = useTranslation();
  const models = useModelStore((s) => s.models);
  const currentModel = useModelStore((s) => s.currentModel);
  const pendingModelId = useModelStatusStore((s) => s.pendingModelId);
  const switchModel = useModelStatusStore((s) => s.switchModel);
  const openModels = useNavigationStore((s) => s.openModels);
  const language = useRecognitionLanguage();
  const downloadProgress = useModelStore((s) => s.downloadProgress);
  const downloadingModels = useModelStore((s) => s.downloadingModels);

  const [menu, setMenu] = useState<"model" | "language" | null>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const languageRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setMenu(null), []);

  const displayId = pendingModelId || currentModel;
  const current = models.find((m) => m.id === displayId);
  const downloaded = models.filter((m) => m.is_downloaded);

  if (!current) return null;

  // Un autre modèle se télécharge : sa progression reste visible ici
  // (comme dans l'ancien pied de page).
  const downloadingId =
    Object.keys(downloadProgress)[0] ?? Object.keys(downloadingModels)[0];
  const downloading = downloadingId
    ? models.find((m) => m.id === downloadingId)
    : undefined;
  const percent = downloadingId
    ? Math.round(downloadProgress[downloadingId]?.percentage ?? 0)
    : 0;

  return (
    <>
      <button
        ref={modelRef}
        type="button"
        className="j-pill"
        aria-haspopup="listbox"
        aria-expanded={menu === "model"}
        aria-label={t("app.home.modelPill", { model: modelName(current, t) })}
        title={t("app.home.modelPill", { model: modelName(current, t) })}
        onClick={() => setMenu(menu === "model" ? null : "model")}
      >
        <Cpu size={14} aria-hidden="true" />
        <span>{modelName(current, t)}</span>
      </button>
      {language.selectable && (
        <button
          ref={languageRef}
          type="button"
          className="j-pill"
          aria-haspopup="listbox"
          aria-expanded={menu === "language"}
          aria-label={t("app.home.languagePill", { language: language.label })}
          title={t("app.home.languagePill", { language: language.label })}
          onClick={() => setMenu(menu === "language" ? null : "language")}
        >
          <Globe size={14} aria-hidden="true" />
          <span>{language.label}</span>
        </button>
      )}

      {downloading && (
        <button
          type="button"
          className="j-pill"
          onClick={openModels}
          title={t("app.home.downloadPill", {
            model: modelName(downloading, t),
            percent,
          })}
        >
          <Download size={14} aria-hidden="true" />
          <span className="j-num">
            {t("app.home.downloadPill", {
              model: modelName(downloading, t),
              percent,
            })}
          </span>
        </button>
      )}

      <Popover
        anchor={modelRef.current}
        open={menu === "model"}
        onClose={close}
        minWidth={240}
        maxHeight={300}
      >
        {(maxHeight) => (
          <OptionList
            options={downloaded.map((m) => ({
              value: m.id,
              label: modelName(m, t),
            }))}
            selectedValue={displayId}
            maxHeight={maxHeight - 44}
            emptyLabel={t("modelSelector.noModelsAvailable")}
            onSelect={(id) => {
              setMenu(null);
              if (id !== currentModel) void switchModel(id);
            }}
            footer={
              <>
                <div className="j-menu-sep" />
                <button
                  type="button"
                  className="j-menu-item"
                  onClick={() => {
                    setMenu(null);
                    openModels();
                  }}
                >
                  <List size={15} aria-hidden="true" />
                  <span>{t("app.home.allModels")}</span>
                </button>
              </>
            }
          />
        )}
      </Popover>
      <Popover
        anchor={languageRef.current}
        open={menu === "language"}
        onClose={close}
        minWidth={220}
        maxHeight={300}
      >
        {(maxHeight) => (
          <OptionList
            options={language.options}
            selectedValue={language.highlighted}
            maxHeight={maxHeight}
            searchPlaceholder={t("settings.general.language.searchPlaceholder")}
            emptyLabel={t("settings.general.language.noResults")}
            onSelect={(code) => {
              setMenu(null);
              void language.select(code);
            }}
          />
        )}
      </Popover>
    </>
  );
};

export default QuickPills;
