import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, Download } from "lucide-react";
import type { ModelInfo } from "@/bindings";
import { Perso } from "@/character/Perso";
import { useModelStore } from "@/stores/modelStore";
import { useSystemLanguage } from "@/hooks/useSystemLanguage";
import { getUniqueCapabilityLanguages } from "@/lib/constants/languages";
import { isLegacyModel } from "../models/ModelRow";
import { formatSize, languageName, languageWithArticle } from "../lib/format";
import { modelDescription, modelName } from "../lib/modelText";

interface WelcomeProps {
  onModelSelected: () => void;
  /** Aperçu (mode débogage) : rien n'est téléchargé ni choisi. */
  preview?: boolean;
}

const LIGHT_MB = 300;

/**
 * Premier lancement : « Bienvenue dans J’écoute », choix du modèle (le cœur
 * classe déjà la liste pour la langue du système), téléchargement.
 */
export const Welcome: React.FC<WelcomeProps> = ({
  onModelSelected,
  preview = false,
}) => {
  const { t, i18n } = useTranslation();
  const systemLanguage = useSystemLanguage();
  const {
    models,
    downloadModel,
    selectModel,
    cancelDownload,
    downloadingModels,
    verifyingModels,
    extractingModels,
    downloadProgress,
    downloadStats,
  } = useModelStore();
  const [picked, setPicked] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selecting = useRef(false);

  const { onDisk, featured, rest, total } = useMemo(() => {
    const usable = models.filter((m) => !isLegacyModel(m) || m.is_downloaded);
    const disk = usable.filter((m) => m.is_downloaded);
    const downloadable = usable.filter((m) => !m.is_downloaded);
    const recommended = downloadable.filter((m) => m.is_recommended);
    const top = [
      ...recommended,
      ...downloadable.filter((m) => !m.is_recommended),
    ].slice(0, 3);
    return {
      onDisk: disk,
      featured: top,
      rest: downloadable.filter((m) => !top.includes(m)),
      total: usable.length,
    };
  }, [models]);

  const firstChoice = onDisk[0]?.id ?? featured[0]?.id ?? null;
  const selectedId = picked ?? firstChoice;
  const selected = models.find((m) => m.id === selectedId);

  // Le modèle choisi est prêt (téléchargé, vérifié, extrait) : on le prend.
  useEffect(() => {
    if (preview || !busyId) return;
    const model = models.find((m) => m.id === busyId);
    if (
      model?.is_downloaded &&
      !(busyId in downloadingModels) &&
      !(busyId in verifyingModels) &&
      !(busyId in extractingModels) &&
      !selecting.current
    ) {
      selecting.current = true;
      selectModel(busyId).then((ok) => {
        if (ok) onModelSelected();
        else {
          toast.error(t("onboarding.errors.selectModel"));
          selecting.current = false;
          setBusyId(null);
        }
      });
    }
  }, [
    busyId,
    models,
    downloadingModels,
    verifyingModels,
    extractingModels,
    selectModel,
    onModelSelected,
    preview,
    t,
  ]);

  const start = async () => {
    if (preview || !selected) return;
    setBusyId(selected.id);
    if (selected.is_downloaded) return; // l'effet ci-dessus le sélectionne
    // L'erreur éventuelle s'affiche déjà via l'événement model-download-failed.
    const ok = await downloadModel(selected.id);
    if (!ok) setBusyId(null);
  };

  const cancel = async () => {
    if (!busyId) return;
    if (await cancelDownload(busyId)) setBusyId(null);
  };

  const busy = busyId !== null;
  const busyModel = models.find((m) => m.id === busyId);
  const progress = busyId ? (downloadProgress[busyId]?.percentage ?? 0) : 0;
  const speed = busyId ? downloadStats[busyId]?.speed : undefined;
  const verifying = busyId ? busyId in verifyingModels : false;
  const extracting = busyId ? busyId in extractingModels : false;

  const tagFor = (model: ModelInfo, index: number) => {
    if (model.is_downloaded)
      return <span className="j-chip ok">{t("app.onboarding.onDisk")}</span>;
    if (index === 0 && model.is_recommended)
      return (
        <span className="j-chip red">
          {systemLanguage
            ? t("app.onboarding.recommendedFor", {
                language: languageWithArticle(systemLanguage, i18n.language),
              })
            : t("onboarding.recommended")}
        </span>
      );
    if (model.supports_streaming)
      return <span className="j-chip">{t("app.models.live")}</span>;
    if (model.size_mb <= LIGHT_MB)
      return <span className="j-chip">{t("app.onboarding.light")}</span>;
    return null;
  };

  const card = (model: ModelInfo, index: number) => {
    const langs = getUniqueCapabilityLanguages(model.supported_languages);
    return (
      <button
        key={model.id}
        type="button"
        role="radio"
        className="j-ocard"
        aria-checked={model.id === selectedId}
        disabled={busy}
        onClick={() => setPicked(model.id)}
      >
        <span className="j-radio" aria-hidden="true" />
        <span className="mid">
          <span className="nm">
            <span>{modelName(model, t)}</span>
            {tagFor(model, index)}
          </span>
          <p>{modelDescription(model, t)}</p>
        </span>
        <span className="ft j-num">
          <b>{formatSize(model.size_mb, i18n.language, t)}</b>
          <span>
            {langs.length === 1
              ? languageName(langs[0], i18n.language)
              : t("modelSelector.capabilities.languageCount", {
                  total: langs.length,
                })}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="j-layer j-onb j-scroll">
      <div className="j-onb-hero">
        <div className="j-contact" aria-hidden="true" />
        <div className="j-hero-perso">
          <Perso mood={busy ? "chargement" : "pret"} />
        </div>
      </div>
      <h1 className="j-display">{t("app.onboarding.welcome")}</h1>
      <p className="lead">{t("app.onboarding.lead")}</p>

      <div
        className="j-ocards"
        role="radiogroup"
        aria-label={t("app.onboarding.choose")}
      >
        {onDisk.map((m) => card(m, -1))}
        {featured.map((m, i) => card(m, i))}
      </div>

      <div className="j-octa">
        {busy && busyModel ? (
          <div className="j-onb-dl" aria-live="polite">
            <div
              className={`j-bar ${verifying || extracting || busyModel.is_downloaded ? "indet" : ""}`}
              role="progressbar"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <b
                style={
                  verifying || extracting || busyModel.is_downloaded
                    ? undefined
                    : { width: `${progress}%` }
                }
              />
            </div>
            <div className="j-onb-dl-l">
              <span>
                {verifying
                  ? t("modelSelector.verifying", {
                      modelName: modelName(busyModel, t),
                    })
                  : extracting
                    ? t("modelSelector.extracting", {
                        modelName: modelName(busyModel, t),
                      })
                    : busyModel.is_downloaded
                      ? t("app.onboarding.preparing", {
                          model: modelName(busyModel, t),
                        })
                      : speed && speed > 0
                        ? t("app.onboarding.downloadingSpeed", {
                            model: modelName(busyModel, t),
                            speed: speed.toFixed(1),
                          })
                        : t("app.onboarding.downloading", {
                            model: modelName(busyModel, t),
                          })}
              </span>
              {!busyModel.is_downloaded && !verifying && !extracting && (
                <span className="j-num">
                  {t("app.onboarding.percent", {
                    percent: Math.round(progress),
                  })}
                </span>
              )}
            </div>
            {!busyModel.is_downloaded && !verifying && !extracting && (
              <div className="flex justify-center mt-2">
                <button type="button" className="j-link" onClick={cancel}>
                  {t("modelSelector.cancelDownload")}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              className="j-btn primary lg"
              disabled={!selected}
              onClick={start}
            >
              {!selected?.is_downloaded && (
                <Download size={18} aria-hidden="true" />
              )}
              {selected
                ? selected.is_downloaded
                  ? t("app.onboarding.use", { model: modelName(selected, t) })
                  : t("app.onboarding.download", {
                      model: modelName(selected, t),
                      size: formatSize(selected.size_mb, i18n.language, t),
                    })
                : t("app.onboarding.choose")}
            </button>
            {rest.length > 0 && (
              <button
                type="button"
                className="j-link inline-flex items-center gap-1"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll
                  ? t("onboarding.showFewerModels")
                  : t("app.onboarding.showAll", { count: total })}
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  style={{
                    transform: showAll ? "rotate(180deg)" : undefined,
                    transition: "transform .2s",
                  }}
                />
              </button>
            )}
          </>
        )}
      </div>

      {showAll && !busy && (
        <div
          className="j-ocards j-onb-more pb-6"
          role="radiogroup"
          aria-label={t("app.onboarding.allModels")}
        >
          {rest.map((m) => card(m, 99))}
        </div>
      )}
      <div className="shrink-0" style={{ height: 24 }} />
    </div>
  );
};

export default Welcome;
