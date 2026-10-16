import React from "react";
import { useTranslation } from "react-i18next";
import { PasteMethodSetting } from "@/components/settings/PasteMethod";
import { TypingToolSetting } from "@/components/settings/TypingTool";
import { ClipboardHandlingSetting } from "@/components/settings/ClipboardHandling";
import { AutoSubmit } from "@/components/settings/AutoSubmit";
import { FillerWordRemoval } from "@/components/settings/FillerWordRemoval";
import { AppendTrailingSpace } from "@/components/settings/AppendTrailingSpace";
import { CustomWords } from "@/components/settings/CustomWords";
import { PostProcessingToggle } from "@/components/settings/PostProcessingToggle";
import { PostProcessingSettings } from "@/components/settings/post-processing/PostProcessingSettings";
import { ChineseScriptSetting } from "@/components/settings/ChineseScript";
import { useSettings } from "@/hooks/useSettings";
import { Accordion } from "../ui/Accordion";

export const TextTab: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting } = useSettings();
  const postProcessing = getSetting("post_process_enabled") ?? false;

  return (
    <>
      <PasteMethodSetting />
      <TypingToolSetting />
      <ClipboardHandlingSetting />
      <AutoSubmit />
      <FillerWordRemoval />
      <AppendTrailingSpace />
      <CustomWords />
      <PostProcessingToggle />
      {postProcessing && <PostProcessingSettings />}
      <Accordion title={t("app.settings.advanced")}>
        <ChineseScriptSetting />
      </Accordion>
    </>
  );
};

export default TextTab;
