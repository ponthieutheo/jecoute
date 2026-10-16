import React from "react";
import { WordCorrectionThreshold } from "./WordCorrectionThreshold";
import { LogLevelSelector } from "./LogLevelSelector";
import { LiveLogViewer } from "./LiveLogViewer";
import { PasteDelay } from "./PasteDelay";
import { HoldThreshold } from "./HoldThreshold";
import { ReliablePasteToggle } from "./ReliablePaste";
import { RecordingBuffer } from "./RecordingBuffer";
import { AlwaysOnMicrophone } from "../AlwaysOnMicrophone";
import { ClamshellMicrophoneSelector } from "../ClamshellMicrophoneSelector";
import { WhatsNewPreview } from "./WhatsNewPreview";
import { KeyboardDiagnostic } from "./KeyboardDiagnostic";
import {
  OnboardingPreview,
  type OnboardingPreviewStep,
} from "./OnboardingPreview";

interface DebugSettingsProps {
  onPreviewOnboarding?: (step: OnboardingPreviewStep) => void;
}

export const DebugSettings: React.FC<DebugSettingsProps> = ({
  onPreviewOnboarding,
}) => {
  // Le thème sonore (onglet Son) et la vérification des mises à jour
  // (onglet Application) ont quitté cette section.
  return (
    <>
      <LogLevelSelector grouped={true} />
      <WhatsNewPreview descriptionMode="tooltip" grouped={true} />
      {onPreviewOnboarding && (
        <OnboardingPreview
          onPreview={onPreviewOnboarding}
          descriptionMode="tooltip"
          grouped={true}
        />
      )}
      <WordCorrectionThreshold descriptionMode="tooltip" grouped={true} />
      <PasteDelay descriptionMode="tooltip" grouped={true} />
      <PasteDelay
        descriptionMode="tooltip"
        grouped={true}
        settingKey="paste_delay_after_ms"
        labelKey="settings.debug.pasteDelayAfter.title"
        descriptionKey="settings.debug.pasteDelayAfter.description"
      />
      <ReliablePasteToggle descriptionMode="tooltip" grouped={true} />
      <HoldThreshold descriptionMode="tooltip" grouped={true} />
      <RecordingBuffer descriptionMode="tooltip" grouped={true} />
      <AlwaysOnMicrophone descriptionMode="tooltip" grouped={true} />
      <ClamshellMicrophoneSelector descriptionMode="tooltip" grouped={true} />
      <KeyboardDiagnostic />
      <LiveLogViewer descriptionMode="tooltip" grouped={true} />
    </>
  );
};
