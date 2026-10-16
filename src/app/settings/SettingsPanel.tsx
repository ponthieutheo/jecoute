import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  SETTINGS_TABS,
  useNavigationStore,
  type SettingsTab,
} from "@/stores/navigationStore";
import { ModelsSheet } from "../models/ModelsSheet";
import { useInert } from "../hooks/useInert";
import { DictationTab } from "./DictationTab";
import { SoundTab } from "./SoundTab";
import { TextTab } from "./TextTab";
import { AppTab } from "./AppTab";
import { AboutTab } from "./AboutTab";

const TAB_LABEL: Record<SettingsTab, string> = {
  dictation: "app.settings.tabs.dictation",
  sound: "app.settings.tabs.sound",
  text: "app.settings.tabs.text",
  app: "app.settings.tabs.app",
  about: "app.settings.tabs.about",
};

const TAB_CONTENT: Record<SettingsTab, React.FC> = {
  dictation: DictationTab,
  sound: SoundTab,
  text: TextTab,
  app: AppTab,
  about: AboutTab,
};

/**
 * Réglages : panneau qui glisse depuis la roue dentée, cinq onglets, et la
 * liste des modèles qui monte par-dessus.
 */
export const SettingsPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const open = useNavigationStore((s) => s.settingsOpen);
  const tab = useNavigationStore((s) => s.tab);
  const modelsOpen = useNavigationStore((s) => s.modelsOpen);
  const setTab = useNavigationStore((s) => s.setTab);
  const closeSettings = useNavigationStore((s) => s.closeSettings);
  const closeModels = useNavigationStore((s) => s.closeModels);
  const focusTarget = useNavigationStore((s) => s.focusTarget);
  const clearFocusTarget = useNavigationStore((s) => s.clearFocusTarget);

  const panelRef = useInert<HTMLElement>(!open);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState<{ x: number; w: number } | null>(null);

  // Trait rouge sous l'onglet choisi (glisse d'un onglet à l'autre).
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabsRef.current?.querySelector<HTMLElement>(
        `[data-tab="${tab}"]`,
      );
      if (!el) return;
      setInk({ x: el.offsetLeft + 9, w: el.offsetWidth - 18 });
    };
    measure();
    document.fonts?.ready.then(measure).catch(() => {});
  }, [tab, i18n.language]);

  useLayoutEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  // Ouverture ciblée (ex. « Choisir un micro ») : la ligne prend le focus.
  useEffect(() => {
    if (!open || !focusTarget) return;
    const timer = setTimeout(() => {
      const target = bodyRef.current?.querySelector<HTMLElement>(
        `[data-focus-id="${focusTarget}"]`,
      );
      target?.scrollIntoView({ block: "nearest" });
      target?.querySelector<HTMLElement>("button, input")?.focus();
      clearFocusTarget();
    }, 460);
    return () => clearTimeout(timer);
  }, [open, focusTarget, clearFocusTarget]);

  // Échap : ferme la liste des modèles, puis les réglages.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector(".j-menu, [role=dialog]")) return;
      // Échap peut être la touche d'un raccourci en cours de saisie.
      if (document.querySelector("[data-recording-shortcut]")) return;
      if (modelsOpen) closeModels();
      else closeSettings();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, modelsOpen, closeModels, closeSettings]);

  const onTabKey = (e: React.KeyboardEvent) => {
    const index = SETTINGS_TABS.indexOf(tab);
    const rtl = i18n.dir() === "rtl";
    let next = index;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight"))
      next = (index + 1) % SETTINGS_TABS.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft"))
      next = (index - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = SETTINGS_TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(SETTINGS_TABS[next]);
    tabsRef.current
      ?.querySelector<HTMLElement>(`[data-tab="${SETTINGS_TABS[next]}"]`)
      ?.focus();
  };

  const Content = TAB_CONTENT[tab];

  return (
    <aside
      ref={panelRef}
      className="j-panel"
      aria-label={t("app.settings.title")}
    >
      <div className="j-p-head">
        <h2 className="j-title">{t("app.settings.title")}</h2>
        <button
          type="button"
          className="j-ibtn"
          onClick={closeSettings}
          aria-label={t("app.settings.close")}
          title={t("app.settings.close")}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="j-tabs" role="tablist" ref={tabsRef} onKeyDown={onTabKey}>
        {SETTINGS_TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`j-tab-${id}`}
            data-tab={id}
            aria-selected={tab === id}
            aria-controls="j-tabpanel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {t(TAB_LABEL[id])}
          </button>
        ))}
        {ink && (
          <span
            className="j-tabs-ink"
            aria-hidden="true"
            style={{ width: ink.w, transform: `translateX(${ink.x}px)` }}
          />
        )}
      </div>
      <div className="j-p-body j-scroll" ref={bodyRef}>
        <div
          key={tab}
          className="j-tab"
          role="tabpanel"
          id="j-tabpanel"
          aria-labelledby={`j-tab-${tab}`}
        >
          <Content />
        </div>
      </div>
      <ModelsSheet />
    </aside>
  );
};

export default SettingsPanel;
