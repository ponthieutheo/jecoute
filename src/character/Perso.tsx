/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

// CONTRAT entre l'interface et la mascotte de la fenêtre principale.
// L'interface ne fait qu'utiliser <Perso /> avec ces props ; tout le reste (3D, animations, regard,
// réactions) vit dans src/character. La scène 3D (home.ts, three.js) est chargée à part, au premier montage.
import React, { useEffect, useRef, useState } from "react";
import PersoHead from "@/components/icons/PersoHead";
import { trackCursor } from "./cursor";
import type { HomeCharacter } from "./home";

/** Ce que la mascotte exprime. */
export type PersoMood =
  | "pret" // repos vivant : respire, cligne, regarde autour, petites animations amusantes
  | "chargement" // le modèle se charge
  | "micro-absent" // aucun micro utilisable
  | "erreur" // erreur de modèle ou de transcription
  | "ecoute" // une dictée est en cours : il tend l'oreille, réagit aux niveaux du micro
  | "frappe" // transcription : il tape au clavier
  | "chuchote"; // post-traitement IA

/** Où il regarde. */
export type PersoLookAt = "souris" | "gauche" | "droite" | "bas";

export interface PersoProps {
  mood: PersoMood;
  /** Niveaux du micro (16 bandes, 0..1) pendant une dictée ; null ou absent sinon. */
  micLevels?: ArrayLike<number> | null;
  /** Regard : suit la souris (défaut), ou fixe une zone de la fenêtre (ex. le panneau de réglages à droite). */
  lookAt?: PersoLookAt;
  /** Version réduite, quand le perso est rangé sur le côté (réglages ouverts). Le perso rapetisse dans son
      conteneur, en douceur : inutile de réduire le conteneur en même temps. */
  compact?: boolean;
  /** Fenêtre cachée ou réduite : boucle de rendu arrêtée (elle s'arrête aussi d'elle-même quand la page est
      cachée). */
  paused?: boolean;
  /** Clic sur le perso (la réaction animée est gérée par le perso lui-même). */
  onPoke?: () => void;
  className?: string;
  /** Bancs d'essai seulement : accès à la scène (saynètes, mesures). */
  testHooks?: (scene: HomeCharacter | null) => void;
}

export const Perso: React.FC<PersoProps> = ({
  mood,
  micLevels,
  lookAt = "souris",
  compact = false,
  paused = false,
  onPoke,
  className = "",
  testHooks,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<HomeCharacter | null>(null);
  const [failed, setFailed] = useState(false);
  // dernières valeurs, pour la scène qui arrive après le premier rendu
  const props = useRef({ mood, lookAt, compact, paused, testHooks });
  props.current = { mood, lookAt, compact, paused, testHooks };

  useEffect(() => {
    let gone = false;
    let scene: HomeCharacter | null = null;
    import("./home")
      .then(({ createHomeCharacter }) => {
        const canvas = canvasRef.current;
        if (gone || !canvas) return;
        try {
          scene = createHomeCharacter(canvas);
        } catch (error) {
          console.error("3D character unavailable, using the 2D head:", error);
          setFailed(true);
          return;
        }
        const p = props.current;
        scene.setCompact(p.compact, true);
        scene.setLookAt(p.lookAt);
        scene.setMood(p.mood);
        scene.setPaused(p.paused);
        sceneRef.current = scene;
        p.testHooks?.(scene);
      })
      .catch((error) => {
        console.error("3D character failed to load:", error);
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
      sceneRef.current = null;
      if (scene) {
        props.current.testHooks?.(null);
        scene.dispose();
      }
    };
  }, []);

  useEffect(() => sceneRef.current?.setMood(mood), [mood]);
  useEffect(() => sceneRef.current?.setLookAt(lookAt), [lookAt]);
  useEffect(() => sceneRef.current?.setCompact(compact), [compact]);
  useEffect(() => sceneRef.current?.setPaused(paused), [paused]);
  useEffect(() => sceneRef.current?.levels(micLevels), [micLevels]);

  // le regard suit le curseur (même hors de la fenêtre, dans l'application)
  useEffect(() => {
    if (paused || lookAt !== "souris" || failed) return;
    return trackCursor((x, y) => sceneRef.current?.pointer(x, y));
  }, [paused, lookAt, failed]);

  const onClick = (e: React.MouseEvent) => {
    const scene = sceneRef.current;
    if (scene && !scene.hit(e.clientX, e.clientY)) return;
    scene?.poke();
    onPoke?.();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const on = sceneRef.current?.hit(e.clientX, e.clientY) ?? false;
    e.currentTarget.style.cursor = on ? "pointer" : "";
  };

  if (failed) {
    const size = compact ? 96 : 168;
    return (
      <button
        type="button"
        onClick={onPoke}
        className={`flex items-center justify-center bg-transparent border-0 p-0 cursor-default ${className}`}
        style={{ width: "100%", height: "100%" }}
        tabIndex={-1}
        aria-hidden="true"
      >
        <PersoHead width={size} height={size} />
      </button>
    );
  }
  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%" }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        onClick={onClick}
        onPointerMove={onPointerMove}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
};

export default Perso;
