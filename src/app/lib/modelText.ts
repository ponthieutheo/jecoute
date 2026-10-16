import type { TFunction } from "i18next";
import type { ModelInfo } from "@/bindings";
import {
  getTranslatedModelDescription,
  getTranslatedModelName,
} from "@/lib/utils/modelTranslation";

/**
 * Clé de traduction tirée de la description anglaise du catalogue
 * (« Highest accuracy, 14 languages, slower » → highest_accuracy_14_languages_slower).
 * Les identifiants de modèles contiennent des points et des barres obliques,
 * inutilisables comme clés i18next.
 */
export const descriptionKey = (description: string): string =>
  description
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);

/** Description d'un modèle dans la langue de l'interface, si elle est traduite. */
export const modelDescription = (model: ModelInfo, t: TFunction): string => {
  if (!model.is_custom && model.description) {
    const translated = t(
      `app.modelDescriptions.${descriptionKey(model.description)}`,
      { defaultValue: "" },
    );
    if (translated) return translated;
  }
  return getTranslatedModelDescription(model, t);
};

export const modelName = (model: ModelInfo, t: TFunction): string =>
  getTranslatedModelName(model, t);
