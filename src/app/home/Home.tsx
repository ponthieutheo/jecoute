import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpCircle, ChartColumn, History, Settings } from "lucide-react";
import { Perso } from "@/character/Perso";
import JecouteWordmark from "@/components/icons/JecouteWordmark";
import AccessibilityPermissions from "@/components/AccessibilityPermissions";
import SecureInputWarning from "@/components/SecureInputWarning";
import { useNavigationStore } from "@/stores/navigationStore";
import { useDictationStore } from "@/stores/dictationStore";
import { useUpdateStore } from "@/stores/updateStore";
import { useHomeState } from "../hooks/useHomeState";
import { usePageVisible } from "../hooks/usePageVisible";
import { Status } from "./Status";
import { RecentCards } from "./RecentCards";

/** Le perso, au centre ; il se range à gauche quand les réglages s'ouvrent. */
const Hero: React.FC<{ mood: ReturnType<typeof useHomeState>["mood"] }> = ({
  mood,
}) => {
  const settingsOpen = useNavigationStore((s) => s.settingsOpen);
  const historyOpen = useNavigationStore((s) => s.historyOpen);
  const statsOpen = useNavigationStore((s) => s.statsOpen);
  const levels = useDictationStore((s) => s.levels);
  const visible = usePageVisible();

  return (
    <div className="j-hero">
      <div className="j-contact" aria-hidden="true" />
      <div className="j-hero-perso">
        <Perso
          mood={mood}
          micLevels={levels}
          lookAt={settingsOpen ? "droite" : "souris"}
          paused={!visible || historyOpen || statsOpen}
        />
      </div>
    </div>
  );
};

export const Home: React.FC = () => {
  const { t } = useTranslation();
  const status = useHomeState();
  const openSettings = useNavigationStore((s) => s.openSettings);
  const openHistory = useNavigationStore((s) => s.openHistory);
  const openStats = useNavigationStore((s) => s.openStats);
  const updateAvailable = useUpdateStore((s) => s.result === "available");

  return (
    <div className="j-layer" data-home-state={status.state}>
      <header className="j-top">
        <JecouteWordmark height={20} />
        <div className="j-top-actions">
          {updateAvailable && (
            <button
              type="button"
              className="j-btn ghost sm j-update-pill"
              onClick={() => openSettings("about")}
            >
              <ArrowUpCircle size={16} aria-hidden="true" />
              {t("app.home.update")}
            </button>
          )}
          <button
            type="button"
            className="j-btn ghost sm"
            onClick={openHistory}
          >
            <History size={16} aria-hidden="true" />
            {t("app.home.history")}
          </button>
          <button type="button" className="j-btn ghost sm" onClick={openStats}>
            <ChartColumn size={16} aria-hidden="true" />
            {t("app.home.stats")}
          </button>
          <button
            type="button"
            className="j-ibtn"
            onClick={() => openSettings()}
            aria-label={t("app.settings.title")}
            title={t("app.settings.title")}
          >
            <Settings size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="j-banner">
        <AccessibilityPermissions />
        <SecureInputWarning />
      </div>

      <Hero mood={status.mood} />
      <Status status={status} />
      <p className="j-side-hint">{t("app.settings.hint")}</p>
      <RecentCards />
    </div>
  );
};

export default Home;
