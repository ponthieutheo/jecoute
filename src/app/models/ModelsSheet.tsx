import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  ArrowLeft,
  AudioLines,
  ChevronDown,
  Globe,
  Languages,
  RefreshCw,
  Search,
} from "lucide-react";
import type { ModelInfo } from "@/bindings";
import { useModelStore } from "@/stores/modelStore";
import { useModelStatusStore } from "@/stores/modelStatusStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useSystemLanguage } from "@/hooks/useSystemLanguage";
import {
  MODEL_CAPABILITY_LANGUAGES,
  supportsLanguageCode,
} from "@/lib/constants/languages";
import { Popover } from "../ui/Popover";
import { useInert } from "../hooks/useInert";
import { OptionList } from "../ui/OptionList";
import { languageName, languageWithArticle } from "../lib/format";
import { modelDescription, modelName } from "../lib/modelText";
import { isLegacyModel, ModelRow, type ModelRowStatus } from "./ModelRow";

/**
 * La liste des modèles (tous ceux du catalogue), dans l'ordre que le cœur
 * calcule pour la langue du système : télécharger, choisir, supprimer.
 */
export const ModelsSheet: React.FC = () => {
  const { t, i18n } = useTranslation();
  const open = useNavigationStore((s) => s.modelsOpen);
  const closeModels = useNavigationStore((s) => s.closeModels);
  const systemLanguage = useSystemLanguage();
  const {
    models,
    currentModel,
    downloadingModels,
    downloadProgress,
    downloadStats,
    verifyingModels,
    extractingModels,
    isRescanning,
    downloadModel,
    cancelDownload,
    deleteModel,
    rescanLocalModels,
  } = useModelStore();
  const switchModel = useModelStatusStore((s) => s.switchModel);
  const pendingModelId = useModelStatusStore((s) => s.pendingModelId);

  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const [streaming, setStreaming] = useState(false);
  const [translation, setTranslation] = useState(false);
  const [langMenu, setLangMenu] = useState(false);
  const langRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const closeLangMenu = useCallback(() => setLangMenu(false), []);
  const sheetRef = useInert<HTMLDivElement>(!open);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: 0 });
  }, [open]);

  const statusOf = (model: ModelInfo): ModelRowStatus => {
    if (model.id in extractingModels) return "extracting";
    if (model.id in verifyingModels) return "verifying";
    if (model.id in downloadingModels) return "downloading";
    if (pendingModelId === model.id && model.id !== currentModel)
      return "switching";
    // Une sélection périmée ne doit jamais faire paraître actif un modèle
    // absent du disque.
    if (!model.is_downloaded) return "downloadable";
    if (model.id === currentModel) return "active";
    return "available";
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return models.filter((model) => {
      if (isLegacyModel(model) && !model.is_downloaded) return false;
      if (
        language !== "all" &&
        !supportsLanguageCode(model.supported_languages, language)
      )
        return false;
      if (streaming && !model.supports_streaming) return false;
      if (translation && !model.supports_translation) return false;
      if (q) {
        const haystack =
          `${model.name} ${model.description} ${modelDescription(model, t)}`.toLocaleLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [models, query, language, streaming, translation, t]);

  const { mine, available } = useMemo(() => {
    const mineList: ModelInfo[] = [];
    const availableList: ModelInfo[] = [];
    for (const model of filtered) {
      if (
        model.is_custom ||
        model.is_downloaded ||
        model.id in downloadingModels ||
        model.id in extractingModels
      )
        mineList.push(model);
      else availableList.push(model);
    }
    mineList.sort((a, b) => {
      if (a.id === currentModel) return -1;
      if (b.id === currentModel) return 1;
      if (a.is_custom !== b.is_custom) return a.is_custom ? 1 : -1;
      return 0;
    });
    return { mine: mineList, available: availableList };
  }, [filtered, downloadingModels, extractingModels, currentModel]);

  const handleDelete = async (model: ModelInfo) => {
    const name = modelName(model, t);
    const confirmed = await ask(
      model.id === currentModel
        ? t("settings.models.deleteActiveConfirm", { modelName: name })
        : t("settings.models.deleteConfirm", { modelName: name }),
      { title: t("settings.models.deleteTitle"), kind: "warning" },
    );
    if (confirmed) await deleteModel(model.id);
  };

  const row = (model: ModelInfo) => (
    <ModelRow
      key={model.id}
      model={model}
      status={statusOf(model)}
      progress={downloadProgress[model.id]?.percentage}
      speed={downloadStats[model.id]?.speed}
      onDownload={() => void downloadModel(model.id)}
      onSelect={() => void switchModel(model.id)}
      onDelete={() => void handleDelete(model)}
      onCancel={() => void cancelDownload(model.id)}
    />
  );

  const languageOptions = useMemo(
    () => [
      { value: "all", label: t("settings.models.filters.allLanguages") },
      ...MODEL_CAPABILITY_LANGUAGES.map((l) => ({
        value: l.value,
        label: languageName(l.value, i18n.language),
      })).sort((a, b) => a.label.localeCompare(b.label, i18n.language)),
    ],
    [t, i18n.language],
  );
  const languageLabel =
    language === "all"
      ? t("settings.models.filters.allLanguages")
      : languageName(language, i18n.language);

  const total = models.filter(
    (m) => !(isLegacyModel(m) && !m.is_downloaded),
  ).length;

  return (
    <div
      ref={sheetRef}
      className="j-sheet"
      data-open={open}
      aria-label={t("app.models.title")}
    >
      <div className="j-p-head">
        <button
          type="button"
          className="j-ibtn"
          onClick={closeModels}
          aria-label={t("app.models.back")}
          title={t("app.models.back")}
        >
          <ArrowLeft
            size={20}
            aria-hidden="true"
            className="rtl:-scale-x-100"
          />
        </button>
        <h2 className="j-title">{t("app.models.title")}</h2>
      </div>
      <div className="j-m-tools">
        <label className="j-field">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("app.models.search")}
            aria-label={t("settings.models.searchPlaceholder")}
          />
        </label>
        <button
          ref={langRef}
          type="button"
          className="j-m-filter lang"
          aria-pressed={language !== "all"}
          aria-haspopup="listbox"
          aria-expanded={langMenu}
          title={languageLabel}
          aria-label={languageLabel}
          onClick={() => setLangMenu((o) => !o)}
        >
          <Globe size={15} aria-hidden="true" />
          {language !== "all" && <span>{languageLabel}</span>}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="j-m-filter"
          aria-pressed={streaming}
          title={t("settings.models.filters.streaming")}
          aria-label={t("settings.models.filters.streaming")}
          onClick={() => setStreaming((v) => !v)}
        >
          <AudioLines size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="j-m-filter"
          aria-pressed={translation}
          title={t("settings.models.filters.translation")}
          aria-label={t("settings.models.filters.translation")}
          onClick={() => setTranslation((v) => !v)}
        >
          <Languages size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="j-m-filter"
          disabled={isRescanning}
          title={t("settings.models.rescan.tooltip")}
          aria-label={t("settings.models.rescan.tooltip")}
          onClick={() => void rescanLocalModels()}
        >
          <RefreshCw
            size={15}
            className={isRescanning ? "j-spin" : ""}
            aria-hidden="true"
          />
        </button>
      </div>
      <Popover
        anchor={langRef.current}
        open={langMenu}
        onClose={closeLangMenu}
        align="end"
        minWidth={220}
        maxHeight={320}
      >
        {(maxHeight) => (
          <OptionList
            options={languageOptions}
            selectedValue={language}
            maxHeight={maxHeight}
            searchPlaceholder={t("settings.general.language.searchPlaceholder")}
            emptyLabel={t("settings.general.language.noResults")}
            onSelect={(value) => {
              setLanguage(value);
              setLangMenu(false);
            }}
          />
        )}
      </Popover>
      <div className="j-m-list j-scroll" ref={listRef}>
        {mine.length > 0 && (
          <section aria-label={t("settings.models.yourModels")}>
            <h3 className="j-m-sec">{t("settings.models.yourModels")}</h3>
            {mine.map(row)}
          </section>
        )}
        {available.length > 0 && (
          <section aria-label={t("settings.models.availableModels")}>
            <h3 className="j-m-sec">{t("settings.models.availableModels")}</h3>
            {available.map(row)}
          </section>
        )}
        {filtered.length === 0 && (
          <p className="j-h-empty">{t("settings.models.noModelsMatch")}</p>
        )}
      </div>
      <div className="j-m-foot">
        <span>
          {systemLanguage
            ? t("app.models.sortedFor", {
                language: languageWithArticle(systemLanguage, i18n.language),
              })
            : t("app.models.sorted")}
        </span>
        <span className="j-num">
          {filtered.length === total
            ? t("app.models.count", { count: total })
            : t("app.models.countFiltered", {
                count: filtered.length,
                total,
              })}
        </span>
      </div>
    </div>
  );
};

export default ModelsSheet;
