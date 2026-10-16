import React from "react";

interface SettingContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Gardé pour compatibilité : la description s'affiche toujours sous le titre. */
  descriptionMode?: "inline" | "tooltip";
  /** Gardé pour compatibilité : toutes les lignes vivent dans le panneau des réglages. */
  grouped?: boolean;
  layout?: "horizontal" | "stacked";
  disabled?: boolean;
  tooltipPosition?: "top" | "bottom";
}

/**
 * Une ligne de réglage : titre et description à gauche, commande à droite
 * (ou dessous en disposition empilée).
 */
export const SettingContainer: React.FC<SettingContainerProps> = ({
  title,
  description,
  children,
  layout = "horizontal",
  disabled = false,
}) => (
  <div
    className={`j-row ${layout === "stacked" ? "stack" : ""} ${
      disabled ? "disabled" : ""
    }`}
  >
    <div className="j-row-l">
      <b>{title}</b>
      {description ? <p>{description}</p> : null}
    </div>
    <div className="j-row-c">{children}</div>
  </div>
);
