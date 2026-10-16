import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import JecouteWordmark from "@/components/icons/JecouteWordmark";
import { AppDataDirectory } from "@/components/settings/AppDataDirectory";
import { LogDirectory } from "@/components/settings/debug/LogDirectory";
import { SettingContainer } from "@/components/ui/SettingContainer";
import { useUpdateStore } from "@/stores/updateStore";

const SOURCE_CODE_URL = "https://github.com/ponthieutheo/jecoute";
const HANDY_URL = "https://github.com/cjpais/Handy";

/** Vérifier et installer une mise à jour (ancien bouton du pied de page). */
const UpdatesRow: React.FC = () => {
  const { t } = useTranslation();
  const {
    enabled,
    isChecking,
    result,
    availableVersion,
    isInstalling,
    downloadProgress,
    checkForUpdates,
    installUpdate,
  } = useUpdateStore();

  let description: string;
  if (!enabled) description = t("footer.updateCheckingDisabled");
  else if (isInstalling)
    description =
      downloadProgress > 0 && downloadProgress < 100
        ? t("app.about.updates.downloading", { progress: downloadProgress })
        : downloadProgress >= 100
          ? t("footer.installing")
          : t("footer.preparing");
  else if (isChecking) description = t("footer.checkingUpdates");
  else if (result === "available")
    description = availableVersion
      ? t("app.about.updates.availableVersion", { version: availableVersion })
      : t("footer.updateAvailableShort");
  else if (result === "upToDate") description = t("app.about.updates.upToDate");
  else if (result === "failed") description = t("app.about.updates.failed");
  else description = t("app.about.updates.auto");

  return (
    <SettingContainer
      title={t("app.about.updates.title")}
      description={description}
    >
      {result === "available" ? (
        <button
          type="button"
          className="j-btn sm primary"
          disabled={!enabled || isInstalling}
          onClick={() => void installUpdate()}
        >
          {isInstalling ? (
            <Loader2 size={14} className="j-spin" aria-hidden="true" />
          ) : (
            <Download size={14} aria-hidden="true" />
          )}
          {t("app.about.updates.install")}
        </button>
      ) : (
        <button
          type="button"
          className="j-btn sm"
          disabled={!enabled || isChecking || isInstalling}
          onClick={() => void checkForUpdates(true)}
        >
          {isChecking ? (
            <Loader2 size={14} className="j-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={14} aria-hidden="true" />
          )}
          {t("app.about.updates.check")}
        </button>
      )}
    </SettingContainer>
  );
};

export const AboutTab: React.FC = () => {
  const { t } = useTranslation();
  const [version, setVersion] = useState("");
  const result = useUpdateStore((s) => s.result);
  const enabled = useUpdateStore((s) => s.enabled);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch((error) => console.error("Failed to get app version:", error));
  }, []);

  const versionLine =
    result === "available"
      ? t("app.about.versionUpdate", { version })
      : result === "upToDate"
        ? t("app.about.versionUpToDate", { version })
        : t("app.about.version", { version });

  return (
    <>
      <div className="j-about-top">
        <JecouteWordmark height={26} />
        <div className="v j-num">
          <span
            className={`j-dot ${result === "available" ? "warn" : ""}`}
            style={enabled ? undefined : { visibility: "hidden" }}
            aria-hidden="true"
          />
          {version && versionLine}
        </div>
      </div>
      <UpdatesRow />
      <SettingContainer
        title={t("settings.about.sourceCode.title")}
        description="github.com/ponthieutheo/jecoute"
      >
        <button
          type="button"
          className="j-btn sm"
          onClick={() => openUrl(SOURCE_CODE_URL)}
        >
          <ExternalLink size={14} aria-hidden="true" />
          {t("common.open")}
        </button>
      </SettingContainer>
      <AppDataDirectory />
      <LogDirectory />
      <div className="j-credit">
        <div className="min-w-0">
          <b>{t("settings.about.basedOn")}</b>
          <div className="j-small">{t("app.about.license")}</div>
        </div>
        <button
          type="button"
          className="j-btn sm shrink-0"
          onClick={() => openUrl(HANDY_URL)}
        >
          <ExternalLink size={14} aria-hidden="true" />
          {t("app.about.handy")}
        </button>
      </div>
      <h3 className="j-grp">{t("settings.about.acknowledgments.title")}</h3>
      <p className="j-small mt-1 mb-0">
        {t("settings.about.acknowledgments.ggml.details")}
      </p>
      <p className="j-small mt-3 mb-0">{t("app.about.character")}</p>
    </>
  );
};

export default AboutTab;
