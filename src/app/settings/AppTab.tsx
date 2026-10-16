import React, { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { ThemeSelector } from "@/components/settings/ThemeSelector";
import { AppLanguageSelector } from "@/components/settings/AppLanguageSelector";
import { AutostartToggle } from "@/components/settings/AutostartToggle";
import { StartHidden } from "@/components/settings/StartHidden";
import { ShowTrayIcon } from "@/components/settings/ShowTrayIcon";
import { ShowOverlay } from "@/components/settings/ShowOverlay";
import { ModelUnloadTimeoutSetting } from "@/components/settings/ModelUnloadTimeout";
import { HistoryLimit } from "@/components/settings/HistoryLimit";
import { RecordingRetentionPeriodSelector } from "@/components/settings/RecordingRetentionPeriod";
import { UpdateChecksToggle } from "@/components/settings/UpdateChecksToggle";
import { ShowWhatsNewOnUpdate } from "@/components/settings/ShowWhatsNewOnUpdate";
import { VoiceActivityDetection } from "@/components/settings/VoiceActivityDetection";
import { ExperimentalToggle } from "@/components/settings/ExperimentalToggle";
import { KeyboardImplementationSelector } from "@/components/settings/debug/KeyboardImplementationSelector";
import { AccelerationSelector } from "@/components/settings/AccelerationSelector";
import { LazyStreamClose } from "@/components/settings/LazyStreamClose";
import { VadBackendSelector } from "@/components/settings/VadBackendSelector";
import { DebugSettings } from "@/components/settings/debug/DebugSettings";
import type { OnboardingPreviewStep } from "@/components/settings/debug/OnboardingPreview";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { useSettings } from "@/hooks/useSettings";
import { Accordion } from "../ui/Accordion";

/** Aperçu du premier lancement, fourni par App (mode débogage). */
export const OnboardingPreviewContext = createContext<
  ((step: OnboardingPreviewStep) => void) | undefined
>(undefined);

export const AppTab: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const experimental = getSetting("experimental_enabled") ?? false;
  const debugMode = getSetting("debug_mode") ?? false;
  const onPreviewOnboarding = useContext(OnboardingPreviewContext);

  return (
    <>
      <ThemeSelector />
      <AppLanguageSelector />
      <AutostartToggle />
      <StartHidden />
      <ShowTrayIcon />
      <ShowOverlay />
      <ModelUnloadTimeoutSetting />
      <HistoryLimit />
      <RecordingRetentionPeriodSelector />
      <UpdateChecksToggle />
      <ShowWhatsNewOnUpdate />
      <Accordion title={t("app.settings.advanced")}>
        <VoiceActivityDetection />
        <ExperimentalToggle />
        {experimental && (
          <>
            <KeyboardImplementationSelector />
            <AccelerationSelector />
            <LazyStreamClose />
            <VadBackendSelector />
          </>
        )}
        <ToggleSwitch
          checked={debugMode}
          onChange={(enabled) => updateSetting("debug_mode", enabled)}
          isUpdating={isUpdating("debug_mode")}
          label={t("app.settings.debugMode.label")}
          description={t("app.settings.debugMode.description")}
        />
      </Accordion>
      {debugMode && (
        <Accordion title={t("settings.debug.title")} defaultOpen>
          <DebugSettings onPreviewOnboarding={onPreviewOnboarding} />
        </Accordion>
      )}
    </>
  );
};

export default AppTab;
