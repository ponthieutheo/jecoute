import React from "react";
// Image dérivée du personnage : licence PolyForm Noncommercial, voir
// src/assets/perso/README.md.
import teteUrl from "@/assets/perso/tete.svg";

interface PersoHeadProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

// Tête du personnage de J’écoute en 2D (icône de la section « Général »).
const PersoHead: React.FC<PersoHeadProps> = ({
  width = 24,
  height = 24,
  className = "",
}) => (
  <img
    src={teteUrl}
    width={width}
    height={height}
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`select-none ${className}`}
  />
);

export default PersoHead;
