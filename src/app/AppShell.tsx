import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WhatsNewGate } from "@/components/whats-new";
import { Dialog } from "@/components/ui/Dialog";
import type { OnboardingPreviewStep } from "@/components/settings/debug/OnboardingPreview";
import { PORTABLE_RELEASES_URL } from "@/components/update-checker/portableInstaller";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNavigationStore } from "@/stores/navigationStore";
import { useHistoryStore } from "@/stores/historyStore";
import { useDictationStore } from "@/stores/dictationStore";
import { useModelStatusStore } from "@/stores/modelStatusStore";
import { useCallsStore } from "@/stores/callsStore";
import { useUpdateStore } from "@/stores/updateStore";
import { getLanguageDirection } from "@/lib/utils/rtl";
import { Home } from "./home/Home";
import { SettingsPanel } from "./settings/SettingsPanel";
import { OnboardingPreviewContext } from "./settings/AppTab";
import { HistoryView } from "./history/HistoryView";
import { StatsView } from "./stats/StatsView";
import { CallsView } from "./calls/CallsView";
import { useInert } from "./hooks/useInert";

/** Vérification des mises à jour au démarrage et depuis la barre des tâches. */
const useUpdaterLifecycle = () => {
  const settings = useSettingsStore((s) => s.settings);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const locked = useSettingsStore((s) => s.updateChecksLocked);
  const setEnabled = useUpdateStore((s) => s.setEnabled);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const openSettings = useNavigationStore((s) => s.openSettings);
  const checkedOnce = useRef(false);

  // Attendre aussi le verrou système (HANDY_DISABLE_UPDATER), sinon un premier
  // rendu pourrait lancer une vérification interdite.
  const loaded = !isLoading && settings !== null && locked !== null;
  const enabled =
    loaded && (settings?.update_checks_enabled ?? false) && locked === false;

  useEffect(() => {
    if (!loaded) return;
    setEnabled(enabled);
    if (enabled && !checkedOnce.current) {
      checkedOnce.current = true;
      void checkForUpdates(false);
    }
    if (!enabled) checkedOnce.current = false;
  }, [loaded, enabled, setEnabled, checkForUpdates]);

  useEffect(() => {
    const unlisten = listen("check-for-updates", () => {
      openSettings("about");
      void useUpdateStore.getState().checkForUpdates(true);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [openSettings]);
};

const PortableUpdateDialog: React.FC = () => {
  const { t } = useTranslation();
  const open = useUpdateStore((s) => s.portableDialogOpen);
  const url = useUpdateStore((s) => s.portableInstallerUrl);
  const close = useUpdateStore((s) => s.closePortableDialog);
  // Sans installeur trouvé, le bouton mène à la page des versions.
  const direct = url !== PORTABLE_RELEASES_URL;
  return (
    <Dialog
      open={open}
      title={t("footer.portableUpdateTitle")}
      closeLabel={t("common.close")}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      footer={
        <>
          <button type="button" className="j-btn sm" onClick={close}>
            {t("common.close")}
          </button>
          <button
            type="button"
            className="j-btn sm primary"
            onClick={() => {
              void openUrl(url);
              close();
            }}
          >
            {direct
              ? t("footer.portableUpdateButton")
              : t("footer.portableUpdateBrowseButton")}
          </button>
        </>
      }
    >
      <p className="text-sm m-0">
        {direct
          ? t("footer.portableUpdateMessage")
          : t("footer.portableUpdateBrowseMessage")}
      </p>
    </Dialog>
  );
};

interface AppShellProps {
  onPreviewOnboarding: (step: OnboardingPreviewStep) => void;
}

/** La fenêtre principale une fois l'app configurée. */
export const AppShell: React.FC<AppShellProps> = ({ onPreviewOnboarding }) => {
  const { i18n } = useTranslation();
  const settingsOpen = useNavigationStore((s) => s.settingsOpen);
  const historyOpen = useNavigationStore((s) => s.historyOpen);
  const statsOpen = useNavigationStore((s) => s.statsOpen);
  const callsOpen = useNavigationStore((s) => s.callsOpen);
  const homeRef = useInert<HTMLDivElement>(
    settingsOpen || historyOpen || statsOpen || callsOpen,
  );

  useEffect(() => {
    useDictationStore.getState().initialize();
    void useHistoryStore.getState().initialize();
    void useModelStatusStore.getState().initialize();
    void useCallsStore.getState().initialize();
  }, []);

  // Micros branchés ou retirés pendant que la fenêtre était cachée.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void useSettingsStore.getState().refreshAudioDevices();
      }
    };
    window.addEventListener("focus", refresh);
    // Un micro est revenu : l'alerte « aucun micro » d'une dictée précédente
    // ne tient plus.
    const unsubscribe = useSettingsStore.subscribe((state, previous) => {
      if (
        state.audioDevices !== previous.audioDevices &&
        (state.inputDeviceCount ?? 0) > 0 &&
        useDictationStore.getState().micProblem === "no-device"
      ) {
        useDictationStore.getState().clearMicProblem();
      }
    });
    return () => {
      window.removeEventListener("focus", refresh);
      unsubscribe();
    };
  }, []);

  useUpdaterLifecycle();

  return (
    <OnboardingPreviewContext.Provider value={onPreviewOnboarding}>
      <div
        className="j-app"
        dir={getLanguageDirection(i18n.language)}
        data-settings={settingsOpen ? "open" : "closed"}
        data-history={historyOpen ? "open" : "closed"}
        data-stats={statsOpen ? "open" : "closed"}
        data-calls={callsOpen ? "open" : "closed"}
      >
        <ErrorBoundary context="What's New">
          <WhatsNewGate />
        </ErrorBoundary>
        <div ref={homeRef} className="j-layer">
          <Home />
        </div>
        <SettingsPanel />
        <HistoryView />
        <StatsView />
        <CallsView />
        <PortableUpdateDialog />
      </div>
    </OnboardingPreviewContext.Provider>
  );
};

export default AppShell;
