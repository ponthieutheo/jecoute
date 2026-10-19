import React from "react";
import { Trans, useTranslation } from "react-i18next";
import { Cpu, Mic, Settings2 } from "lucide-react";
import { platform } from "@tauri-apps/plugin-os";
import { commands } from "@/bindings";
import { useSettingsStore } from "@/stores/settingsStore";
import { useNavigationStore } from "@/stores/navigationStore";
import type { HomeStatus } from "../hooks/useHomeState";
import { KeyCombo } from "../ui/KeyCombo";
import { QuickPills } from "./QuickPills";
import { CallStatus } from "./CallStatus";

const currentPlatform = (): string => {
  try {
    return platform();
  } catch {
    return "unknown";
  }
};

/** L'état sous le perso : titre, phrase d'aide, pastilles ou action. */
export const Status: React.FC<{ status: HomeStatus }> = ({ status }) => {
  const { t } = useTranslation();
  const openSettings = useNavigationStore((s) => s.openSettings);
  const openModels = useNavigationStore((s) => s.openModels);
  const binding = useSettingsStore(
    (s) => s.settings?.bindings?.transcribe?.current_binding,
  );
  const activation = useSettingsStore(
    (s) => s.settings?.shortcut_activation ?? "hold_or_toggle",
  );
  const pasteMethod = useSettingsStore((s) => s.settings?.paste_method);

  const keys = <KeyCombo combination={binding} />;
  const toggle = activation === "toggle";
  const { state, model } = status;

  let title: string;
  let desc: React.ReactNode = null;
  let extra: React.ReactNode = null;

  switch (state) {
    case "ready":
      title = t("app.status.ready.title");
      desc = (
        <Trans
          i18nKey={
            toggle ? "app.status.ready.descToggle" : "app.status.ready.desc"
          }
          components={{ keys }}
        />
      );
      extra = (
        <div className="j-st-chips">
          <QuickPills />
        </div>
      );
      break;
    case "loading":
      title = model
        ? t("app.status.loading.title", { model })
        : t("app.status.loading.titleGeneric");
      desc = t("app.status.loading.desc");
      extra = (
        <div className="j-bar indet j-st-progress" aria-hidden="true">
          <b />
        </div>
      );
      break;
    case "downloading": {
      title = t("app.status.downloading.title", { model });
      const percent = status.downloadPercent ?? 0;
      desc =
        status.downloadSpeed != null
          ? t("app.status.downloading.descSpeed", {
              percent,
              speed: status.downloadSpeed.toFixed(1),
            })
          : t("app.status.downloading.desc", { percent });
      extra = (
        <div
          className="j-bar j-st-progress"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
        >
          <b style={{ width: `${percent}%` }} />
        </div>
      );
      break;
    }
    case "nomic":
      title = t("app.status.noMic.title");
      desc = t("app.status.noMic.desc");
      extra = (
        <button
          type="button"
          className="j-btn sm j-st-fix"
          onClick={() => openSettings("sound", "microphone")}
        >
          <Mic size={16} aria-hidden="true" />
          {t("app.status.noMic.action")}
        </button>
      );
      break;
    case "micDenied": {
      const os = currentPlatform();
      title = t("app.status.micDenied.title");
      desc = t(`errors.micPermissionDenied.${os}`, {
        defaultValue: t("errors.micPermissionDenied.generic"),
      });
      extra =
        os === "windows" ? (
          <button
            type="button"
            className="j-btn sm j-st-fix"
            onClick={() => void commands.openMicrophonePrivacySettings()}
          >
            <Settings2 size={16} aria-hidden="true" />
            {t("app.status.micDenied.action")}
          </button>
        ) : null;
      break;
    }
    case "nomodel":
      title = t("app.status.noModel.title");
      desc = t("app.status.noModel.desc");
      extra = (
        <button
          type="button"
          className="j-btn sm primary j-st-fix"
          onClick={openModels}
        >
          <Cpu size={16} aria-hidden="true" />
          {t("app.status.noModel.action")}
        </button>
      );
      break;
    case "error":
      title = t("app.status.error.title");
      desc = (
        <span className="err-detail" title={status.error ?? undefined}>
          {status.error || t("app.status.error.desc")}
        </span>
      );
      extra = (
        <button
          type="button"
          className="j-btn sm j-st-fix"
          onClick={openModels}
        >
          <Cpu size={16} aria-hidden="true" />
          {t("app.status.error.action")}
        </button>
      );
      break;
    case "listening":
      title = t("app.status.listening.title");
      desc = (
        <Trans
          i18nKey={
            toggle
              ? "app.status.listening.descToggle"
              : "app.status.listening.desc"
          }
          components={{ keys }}
        />
      );
      break;
    case "writing":
      title = t("app.status.writing.title");
      desc = model
        ? t("app.status.writing.desc", { model })
        : t("app.status.writing.descGeneric");
      break;
    case "processing":
      title = t("app.status.processing.title");
      desc = t("app.status.processing.desc");
      break;
    case "call":
      return <CallStatus dot={status.dot} />;
    case "done":
      title =
        pasteMethod === "none"
          ? t("app.status.done.titleNoPaste")
          : t("app.status.done.title");
      desc = t("app.status.done.desc");
      break;
  }

  return (
    <div className="j-status" aria-live="polite">
      <div className="j-st-title">
        <span className={`j-dot ${status.dot}`} aria-hidden="true" />
        <span className="j-st-text full">{title}</span>
        <span className="j-st-text short">
          {t(`app.status.short.${state}`)}
        </span>
      </div>
      <p className="j-st-desc">{desc}</p>
      {extra}
    </div>
  );
};

export default Status;
