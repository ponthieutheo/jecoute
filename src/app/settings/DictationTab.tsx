import React from "react";
import { useTranslation } from "react-i18next";
import { type } from "@tauri-apps/plugin-os";
import { Check, Loader2, TriangleAlert } from "lucide-react";
import { ShortcutInput } from "@/components/settings/ShortcutInput";
import { ShortcutActivationSetting } from "@/components/settings/ShortcutActivation";
import { LanguageSelector } from "@/components/settings/LanguageSelector";
import { TranslateToEnglish } from "@/components/settings/TranslateToEnglish";
import { SettingContainer } from "@/components/ui/SettingContainer";
import { useModelStore } from "@/stores/modelStore";
import { useModelStatusStore } from "@/stores/modelStatusStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { getUniqueCapabilityLanguages } from "@/lib/constants/languages";
import { formatSize } from "../lib/format";
import { modelName } from "../lib/modelText";

/** Le modèle actif, avec un accès direct à la liste des modèles. */
const ActiveModel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const models = useModelStore((s) => s.models);
  const currentModel = useModelStore((s) => s.currentModel);
  const status = useModelStatusStore((s) => s.status);
  const pendingModelId = useModelStatusStore((s) => s.pendingModelId);
  const openModels = useNavigationStore((s) => s.openModels);
  const model = models.find((m) => m.id === (pendingModelId || currentModel));

  return (
    <SettingContainer
      title={t("app.settings.model.title")}
      description=""
      layout="stacked"
    >
      <div className="j-model-card w-full">
        <span className="nm">
          {model ? modelName(model, t) : t("app.settings.model.none")}
        </span>
        <button type="button" className="j-btn sm" onClick={openModels}>
          {model
            ? t("app.settings.model.change")
            : t("app.settings.model.choose")}
        </button>
        {model && (
          <span className="meta">
            {status === "loading" ? (
              <span className="j-chip">
                <Loader2 size={14} className="j-spin" aria-hidden="true" />
                {t("app.settings.model.loading")}
              </span>
            ) : status === "error" ? (
              <span className="j-chip red">
                <TriangleAlert size={14} aria-hidden="true" />
                {t("app.settings.model.error")}
              </span>
            ) : (
              <span className="j-chip ok">
                <Check size={14} aria-hidden="true" />
                {t("modelSelector.active")}
              </span>
            )}
            <span className="j-chip">
              {formatSize(model.size_mb, i18n.language, t)}
            </span>
            <span className="j-chip">
              {t("modelSelector.capabilities.languageCount", {
                total: getUniqueCapabilityLanguages(model.supported_languages)
                  .length,
              })}
            </span>
          </span>
        )}
      </div>
    </SettingContainer>
  );
};

export const DictationTab: React.FC = () => {
  const models = useModelStore((s) => s.models);
  const currentModel = useModelStore((s) => s.currentModel);
  const model = models.find((m) => m.id === currentModel);
  // Le raccourci d'annulation reste masqué sous Linux (raccourcis dynamiques
  // instables), comme dans Handy.
  const isLinux = type() === "linux";

  return (
    <>
      <ShortcutInput shortcutId="transcribe" />
      <ShortcutActivationSetting />
      {!isLinux && <ShortcutInput shortcutId="cancel" />}
      <ActiveModel />
      {model?.supports_language_selection && (
        <LanguageSelector
          supportedLanguages={model.supported_languages}
          supportsLanguageDetection={model.supports_language_detection}
        />
      )}
      {model?.supports_translation && <TranslateToEnglish />}
    </>
  );
};

export default DictationTab;
