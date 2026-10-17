/* Le personnage de J’écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

export {
  createOverlayCharacter,
  STAGE_W,
  STAGE_H,
  PIXEL_RATIO_CAP,
} from "./stage";
export type {
  OverlayCharacter,
  OverlayCharacterOptions,
  FrameStats,
} from "./stage";
export { EXIT_REACTION, EXIT_POP } from "./choreography";
export type { CharacterState, ExitReason } from "./choreography";
