import React from "react";
import { useTranslation } from "react-i18next";
import { useOsType } from "@/hooks/useOsType";
import { keyLabels } from "../lib/keys";

const PLUS = "+";

interface KeyComboProps {
  combination: string | null | undefined;
  /** Touches en cours de saisie (bordure rouge). */
  recording?: boolean;
  className?: string;
}

/** Un raccourci clavier dessiné en touches : [Ctrl] + [Espace]. */
export const KeyCombo: React.FC<KeyComboProps> = ({
  combination,
  recording = false,
  className = "",
}) => {
  const { t } = useTranslation();
  const os = useOsType();
  const labels = keyLabels(combination, t, os);
  return (
    <span className={`j-keys ${className}`}>
      {labels.map((label, index) => (
        <React.Fragment key={`${label}-${index}`}>
          {index > 0 && (
            <span className="j-plus" aria-hidden="true">
              {PLUS}
            </span>
          )}
          <kbd className={`j-key ${recording ? "recording" : ""}`}>{label}</kbd>
        </React.Fragment>
      ))}
    </span>
  );
};

export default KeyCombo;
