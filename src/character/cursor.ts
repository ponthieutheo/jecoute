/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Où est le curseur, pour le regard du perso : position dans la fenêtre, en px CSS.
   - Dans la fenêtre : les événements pointermove (aucun coût quand la souris ne bouge pas).
   - Hors de la fenêtre (application Tauri seulement) : la position du curseur à l'écran est demandée ~12 fois par
     seconde, et seulement tant qu'il est dehors ; la position de la fenêtre est relue une fois par seconde. Le
     rapport px écran / px CSS est window.devicePixelRatio (échelle de l'écran et zoom du texte compris).
   Hors de Tauri (navigateur), le dernier point connu reste. */

import { cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";

const POLL_MS = 80;
const WINDOW_POS_MS = 1000;

/** Suit le curseur ; renvoie la fonction qui arrête le suivi. */
export function trackCursor(onMove: (x: number, y: number) => void) {
  const inTauri = "__TAURI_INTERNALS__" in window;
  let timer = 0;
  let busy = false;
  let origin: { x: number; y: number; at: number } | null = null;

  const stopPolling = () => {
    window.clearInterval(timer);
    timer = 0;
  };
  const poll = async () => {
    if (busy) return;
    busy = true;
    try {
      const now = performance.now();
      if (!origin || now - origin.at > WINDOW_POS_MS) {
        const p = await getCurrentWindow().innerPosition();
        origin = { x: p.x, y: p.y, at: now };
      }
      const c = await cursorPosition();
      if (timer && origin) {
        const k = window.devicePixelRatio || 1;
        onMove((c.x - origin.x) / k, (c.y - origin.y) / k);
      }
    } catch {
      stopPolling(); // API indisponible : on garde le dernier point connu
    } finally {
      busy = false;
    }
  };

  const onPointer = (e: PointerEvent) => {
    if (timer) stopPolling();
    onMove(e.clientX, e.clientY);
  };
  const onLeave = (e: MouseEvent) => {
    // relatedTarget nul : le curseur vient de quitter la fenêtre
    if (e.relatedTarget || !inTauri || timer) return;
    origin = null;
    timer = window.setInterval(poll, POLL_MS);
  };

  window.addEventListener("pointermove", onPointer, { passive: true });
  document.addEventListener("mouseout", onLeave);
  // au départ, rien ne dit que le curseur est dans la fenêtre : on le cherche jusqu'au premier pointermove
  if (inTauri) timer = window.setInterval(poll, POLL_MS);
  return () => {
    stopPolling();
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("mouseout", onLeave);
  };
}
