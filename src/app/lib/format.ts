import type { TFunction } from "i18next";
import {
  getLanguageLabel,
  recognitionLanguage,
} from "@/lib/constants/languages";

/** Taille d'un modèle dans la langue de l'interface : « 1,6 Go », « 716 Mo ». */
export const formatSize = (
  sizeMb: number | null | undefined,
  language: string,
  t: TFunction,
): string => {
  if (!sizeMb || !Number.isFinite(sizeMb) || sizeMb <= 0) return "";
  if (sizeMb >= 1024) {
    const gb = sizeMb / 1024;
    const value = new Intl.NumberFormat(language, {
      minimumFractionDigits: gb >= 10 ? 0 : 1,
      maximumFractionDigits: gb >= 10 ? 0 : 1,
    }).format(gb);
    return t("app.units.gb", { value });
  }
  const value = new Intl.NumberFormat(language, {
    maximumFractionDigits: 0,
  }).format(sizeMb);
  return t("app.units.mb", { value });
};

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const capitalize = (s: string, language: string) =>
  s.charAt(0).toLocaleUpperCase(language) + s.slice(1);

/** « Aujourd’hui », « Hier » ou « Mercredi 14 octobre » (année si ancienne). */
export const formatDay = (
  timestampSec: number,
  language: string,
  t: TFunction,
  now: Date = new Date(),
): string => {
  const date = new Date(timestampSec * 1000);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays === 0) return t("app.dates.today");
  if (diffDays === 1) return t("app.dates.yesterday");
  const sameYear = date.getFullYear() === now.getFullYear();
  return capitalize(
    new Intl.DateTimeFormat(language, {
      weekday: diffDays < 7 ? "long" : undefined,
      day: "numeric",
      month: "long",
      year: sameYear ? undefined : "numeric",
    }).format(date),
    language,
  );
};

/** Clé de regroupement par jour (heure locale). */
export const dayKey = (timestampSec: number): number =>
  startOfDay(new Date(timestampSec * 1000));

export const formatTime = (timestampSec: number, language: string): string =>
  new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestampSec * 1000));

/** Jour et heure, court : « Aujourd’hui, 21:53 », « 14 oct., 22:11 ». */
export const formatWhen = (
  timestampSec: number,
  language: string,
  t: TFunction,
  now: Date = new Date(),
): string => {
  const date = new Date(timestampSec * 1000);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  const time = formatTime(timestampSec, language);
  if (diffDays === 0) return t("app.dates.todayAt", { time });
  if (diffDays === 1) return t("app.dates.yesterdayAt", { time });
  const day = new Intl.DateTimeFormat(language, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
  return t("app.dates.dayAt", { day, time });
};

/** Nom d'une langue dans la langue de l'interface (« fr » → « Français »). */
export const languageName = (code: string, uiLanguage: string): string => {
  const base = recognitionLanguage(code);
  const fallback = getLanguageLabel(code) ?? code;
  try {
    const name = new Intl.DisplayNames([uiLanguage], { type: "language" }).of(
      base,
    );
    if (!name || name.toLowerCase() === base) return fallback;
    return capitalize(name, uiLanguage);
  } catch {
    return fallback;
  }
};

/**
 * Nom de langue précédé de son article, pour « pour le français »,
 * « pour l’anglais » ; dans les autres langues, le nom seul.
 */
export const languageWithArticle = (
  code: string,
  uiLanguage: string,
): string => {
  const name = languageName(code, uiLanguage);
  if (!uiLanguage.startsWith("fr")) return name;
  const lower = name.toLocaleLowerCase("fr");
  // h aspiré (« le hongrois ») sauf « l’hébreu ».
  return /^([aeiouyâéèêëîïôûü]|hé)/i.test(lower) ? `l’${lower}` : `le ${lower}`;
};
