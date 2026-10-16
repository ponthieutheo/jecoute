import type { TFunction } from "i18next";
import { formatKeyCombination, type OSType } from "@/lib/utils/keyboard";

const NAMED: Record<string, string> = {
  ctrl: "ctrl",
  control: "ctrl",
  shift: "shift",
  alt: "alt",
  option: "option",
  space: "space",
  esc: "escape",
  escape: "escape",
  enter: "enter",
  return: "enter",
  tab: "tab",
  backspace: "backspace",
  delete: "delete",
  capslock: "capslock",
  up: "up",
  down: "down",
  left: "arrowLeft",
  right: "arrowRight",
  insert: "insert",
  home: "home",
  end: "end",
  pageup: "pageUp",
  pagedown: "pageDown",
};

const META = new Set(["command", "cmd", "super", "win", "windows", "meta"]);

const labelFor = (raw: string, t: TFunction, os: OSType): string => {
  const key = raw.trim().toLowerCase();
  if (!key) return "";
  if (META.has(key)) {
    return os === "macos"
      ? t("app.keys.cmd")
      : os === "windows"
        ? t("app.keys.win")
        : t("app.keys.super");
  }
  const named = NAMED[key];
  if (named) return t(`app.keys.${named}`);
  return formatKeyCombination(key, os);
};

/**
 * Noms des touches d'un raccourci (« ctrl+space » → ["Ctrl", "Espace"]),
 * traduits ; les variantes gauche/droite gardent leur côté.
 */
export const keyLabels = (
  combination: string | undefined | null,
  t: TFunction,
  os: OSType,
): string[] => {
  if (!combination) return [];
  return combination
    .split("+")
    .filter((part) => part.trim() !== "")
    .map((part) => {
      const trimmed = part.trim().toLowerCase();
      if (trimmed.endsWith("_left")) {
        return t("app.keys.leftSide", {
          key: labelFor(trimmed.slice(0, -5), t, os),
        });
      }
      if (trimmed.endsWith("_right")) {
        return t("app.keys.rightSide", {
          key: labelFor(trimmed.slice(0, -6), t, os),
        });
      }
      return labelFor(trimmed, t, os);
    });
};
