/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

// CONTRAT entre l'interface et la mascotte de la fenêtre principale.
// L'interface ne fait qu'utiliser <Perso /> avec ces props ; tout le reste (3D, animations, regard,
// réactions) vit dans src/character. Version PROVISOIRE : tête 2D fixe, en attendant la vraie scène 3D.
import React from "react";
import PersoHead from "@/components/icons/PersoHead";

/** Ce que la mascotte exprime. */
export type PersoMood =
  | "pret" // repos vivant : respire, cligne, regarde autour, petites animations amusantes
  | "chargement" // le modèle se charge
  | "micro-absent" // aucun micro utilisable
  | "erreur" // erreur de modèle ou de transcription
  | "ecoute" // une dictée est en cours : il tend l'oreille, réagit aux niveaux du micro
  | "frappe" // transcription : il tape au clavier
  | "chuchote"; // post-traitement IA

export interface PersoProps {
  mood: PersoMood;
  /** Niveaux du micro (16 bandes, 0..1) pendant une dictée ; null ou absent sinon. */
  micLevels?: ArrayLike<number> | null;
  /** Regard : suit la souris (défaut), ou fixe une zone de la fenêtre (ex. le panneau de réglages à droite). */
  lookAt?: "souris" | "gauche" | "droite" | "bas";
  /** Version réduite, quand le perso est rangé sur le côté (réglages ouverts). */
  compact?: boolean;
  /** Fenêtre cachée ou réduite : boucle de rendu arrêtée. */
  paused?: boolean;
  /** Clic sur le perso (la réaction animée est gérée par le perso lui-même). */
  onPoke?: () => void;
  className?: string;
}

export const Perso: React.FC<PersoProps> = ({
  compact,
  onPoke,
  className = "",
}) => {
  const size = compact ? 96 : 168;
  return (
    <button
      type="button"
      onClick={onPoke}
      className={`flex items-center justify-center bg-transparent border-0 p-0 cursor-default ${className}`}
      tabIndex={-1}
      aria-hidden="true"
    >
      <PersoHead width={size} height={size} />
    </button>
  );
};

export default Perso;
