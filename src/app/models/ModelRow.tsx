import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Download, Loader2, Trash2, X } from "lucide-react";
import type { ModelInfo } from "@/bindings";
import { getUniqueCapabilityLanguages } from "@/lib/constants/languages";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatSize, languageName } from "../lib/format";
import { modelDescription, modelName } from "../lib/modelText";

export type ModelRowStatus =
  | "downloadable"
  | "downloading"
  | "verifying"
  | "extracting"
  | "switching"
  | "active"
  | "available";

// Ancien téléchargement (.bin/ONNX hérité de Handy) encore présent sur le disque.
export const isLegacyModel = (model: ModelInfo): boolean =>
  typeof model.source === "object" && "Url" in model.source;

const quantLabel = (filename: string): string | null => {
  const match = filename.match(
    /[._-](IQ\d+_\w+|Q\d+(?:_\w+)?|F16|BF16|F32)\.gguf$/i,
  );
  return match ? match[1].toUpperCase() : null;
};

interface ModelRowProps {
  model: ModelInfo;
  status: ModelRowStatus;
  progress?: number;
  speed?: number;
  onDownload: () => void;
  onSelect: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export const ModelRow: React.FC<ModelRowProps> = ({
  model,
  status,
  progress,
  speed,
  onDownload,
  onSelect,
  onDelete,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const debugMode = useSettingsStore((s) => s.settings?.debug_mode ?? false);
  const name = modelName(model, t);
  const languages = getUniqueCapabilityLanguages(model.supported_languages);
  const languagesLabel =
    languages.length === 1
      ? t("modelSelector.capabilities.languageOnly", {
          language: languageName(languages[0], i18n.language),
        })
      : languages.length > 1
        ? t("modelSelector.capabilities.languageCount", {
            total: languages.length,
          })
        : "";
  const size = formatSize(Number(model.size_mb), i18n.language, t);
  const quant = debugMode ? quantLabel(model.filename) : null;
  const downloaded = status === "active" || status === "available";

  let action: React.ReactNode;
  switch (status) {
    case "active":
      action = (
        <span className="j-m-active">
          <Check size={16} aria-hidden="true" />
          {t("modelSelector.active")}
        </span>
      );
      break;
    case "available":
      action = (
        <button type="button" className="j-btn sm" onClick={onSelect}>
          {t("app.models.use")}
        </button>
      );
      break;
    case "switching":
      action = (
        <span className="j-m-active j-muted">
          <Loader2 size={15} className="j-spin" aria-hidden="true" />
          {t("modelSelector.switching")}
        </span>
      );
      break;
    case "downloading":
      action = (
        <button
          type="button"
          className="j-btn sm ghost"
          onClick={onCancel}
          aria-label={t("modelSelector.cancelDownload")}
        >
          <X size={14} aria-hidden="true" />
          {t("modelSelector.cancel")}
        </button>
      );
      break;
    case "verifying":
    case "extracting":
      action = (
        <span className="j-m-active j-muted">
          <Loader2 size={15} className="j-spin" aria-hidden="true" />
          {status === "verifying"
            ? t("modelSelector.verifyingGeneric")
            : t("modelSelector.extractingGeneric")}
        </span>
      );
      break;
    default:
      action = (
        <button type="button" className="j-btn sm" onClick={onDownload}>
          <Download size={14} aria-hidden="true" />
          {t("app.models.download")}
        </button>
      );
  }

  return (
    <div className="j-m-row">
      <span className="nm">
        <span>{name}</span>
        {model.is_recommended && (
          <span className="j-chip red">{t("onboarding.recommended")}</span>
        )}
        {model.supports_streaming && (
          <span
            className="j-chip"
            title={t("modelSelector.capabilities.streaming")}
          >
            {t("app.models.live")}
          </span>
        )}
        {model.is_custom && (
          <span className="j-chip">{t("modelSelector.custom")}</span>
        )}
        {isLegacyModel(model) && (
          <span className="j-chip">{t("modelSelector.legacy")}</span>
        )}
      </span>
      <p>{modelDescription(model, t)}</p>
      {(model.accuracy_score > 0 || model.speed_score > 0) && (
        <div className="j-m-bars">
          <span>
            {t("app.models.accuracy")}
            <span className="j-bar" aria-hidden="true">
              <b style={{ width: `${model.accuracy_score * 100}%` }} />
            </span>
          </span>
          <span>
            {t("app.models.speed")}
            <span className="j-bar" aria-hidden="true">
              <b style={{ width: `${model.speed_score * 100}%` }} />
            </span>
          </span>
          {model.supports_translation && (
            <span title={t("modelSelector.capabilities.translation")}>
              {t("app.models.translation")}
            </span>
          )}
        </div>
      )}
      <div className="side">
        <div className="flex items-center gap-1">
          {action}
          {downloaded && (
            <button
              type="button"
              className="j-ibtn sm"
              onClick={onDelete}
              title={t("modelSelector.deleteModel", { modelName: name })}
              aria-label={t("modelSelector.deleteModel", { modelName: name })}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <span className="sz j-num">
          {[size, languagesLabel, quant].filter(Boolean).join(", ")}
        </span>
      </div>
      {status === "downloading" && (
        <div className="dl">
          <div className="j-bar" aria-hidden="true">
            <b style={{ width: `${progress ?? 0}%` }} />
          </div>
          <div className="dl-l j-num">
            <span>
              {t("modelSelector.downloading", {
                percentage: Math.round(progress ?? 0),
              })}
            </span>
            {speed !== undefined && speed > 0 && (
              <span>
                {t("modelSelector.downloadSpeed", { speed: speed.toFixed(1) })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelRow;
