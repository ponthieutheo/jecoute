/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* La scène du personnage dans la fenêtre d'enregistrement : moteur de rendu transparent, caméra, lumières
   (les mêmes que la scène d'origine), boucle d'animation.

   - La boucle ne tourne que pendant que le personnage est à l'écran ; elle s'arrête d'elle-même après la sortie,
     sur une image vide (transparente), pour qu'un nouvel affichage ne montre jamais une image périmée.
   - Shaders et textures sont préparés au chargement de la page (la fenêtre est créée cachée au démarrage), pour
     que la première apparition ne saccade pas.
   - Le contexte WebGL est gardé d'un affichage à l'autre ; s'il est perdu, l'animation continue sans rendu (la
     sortie se termine quand même) et tout est renvoyé au GPU à sa restauration.
   - Résolution de rendu fixée à 2 pixels par pixel CSS (plafond) : à 100 % c'est un suréchantillonnage 2×2
     (bords de l'encoche et des traits nets), à 200 % c'est la résolution native. */

import * as THREE from "three";
import { Choreography } from "./choreography";
import type { CharacterState, ExitReason } from "./choreography";
import { HS } from "./head";
import { createFrameMeter } from "./meter";
import type { FrameStats } from "./meter";
import { addLights, createRig, prepareRig, watchContextLoss } from "./rig";

export type { FrameStats };

/** Taille de la scène, en pixels CSS. La fenêtre native (overlay.rs) a exactement cette taille. */
export const STAGE_W = 224;
export const STAGE_H = 144;
/** Résolution de rendu (plafond du devicePixelRatio). */
export const PIXEL_RATIO_CAP = 2;

/** Cadrage, en unités de la scène (rayon de la tête = 0,88), centre de la tête à l'origine. */
const VIEW_BOTTOM = -1.1;
const VIEW_TOP = 2.03;
const FOV = 24;

export interface OverlayCharacter {
  readonly canvas: HTMLCanvasElement;
  /** Vrai une fois shaders et textures prêts. */
  readonly ready: Promise<void>;
  show(state: CharacterState): void;
  micReady(): void;
  levels(l: ArrayLike<number>): void;
  error(): void;
  /** Lance la sortie ; `token` est rendu à onExitDone une fois la dernière image (vide) affichée. */
  hide(reason: ExitReason, token?: unknown): void;
  /** Retire le personnage tout de suite, sans animation (une autre forme d'overlay prend la fenêtre). */
  abort(): void;
  stats(reset?: boolean): FrameStats;
  dispose(): void;
}

export interface OverlayCharacterOptions {
  onExitDone?: (token: unknown) => void;
  /** Mesure le temps GPU de chaque image (EXT_disjoint_timer_query_webgl2). */
  measureGpu?: boolean;
  /** Limite la cadence à ~60 i/s sur les écrans plus rapides (défaut : vrai). */
  capFps?: boolean;
}

export function createOverlayCharacter(
  canvas: HTMLCanvasElement,
  opts: OverlayCharacterOptions = {},
): OverlayCharacter {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x000000, 0);
  // Vérification synchrone des shaders (journal du compilateur) : en développement seulement.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.setPixelRatio(PIXEL_RATIO_CAP);
  renderer.setSize(STAGE_W, STAGE_H, true);

  const scene = new THREE.Scene();
  const viewH = VIEW_TOP - VIEW_BOTTOM;
  const dist = viewH / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));
  const camera = new THREE.PerspectiveCamera(FOV, STAGE_W / STAGE_H, 0.1, 40);
  const yc = (VIEW_TOP + VIEW_BOTTOM) / 2;
  camera.position.set(0, yc + 0.6, dist);
  camera.lookAt(0, yc, 0);

  // mêmes lumières que la scène d'origine ; le personnage : pivot du pop au bas de la tête
  addLights(scene);
  const rig = createRig(renderer);
  scene.add(rig.root);
  const choreo = new Choreography(rig);
  const meter = createFrameMeter(renderer, rig.head.face, !!opts.measureGpu);
  // perte de contexte : l'animation continue sans rendu, tout repart au GPU à la restauration
  const context = watchContextLoss(canvas, renderer, scene, camera, rig);

  // ---------- boucle ----------
  let raf = 0;
  let running = false;
  let lastNow = 0;
  let lastRender = 0;
  let clock = 0;
  let isReady = false;
  let disposed = false;
  let exitToken: unknown = undefined;
  let exitPending = false;
  let ackFrame = false;
  const capFps = opts.capFps !== false;

  const render = () => {
    if (context.lost()) return;
    meter.render(scene, camera);
  };

  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (ackFrame) {
      // l'image vide a été affichée : la fenêtre native peut être cachée
      ackFrame = false;
      stop();
      const tk = exitToken;
      exitToken = undefined;
      exitPending = false;
      opts.onExitDone?.(tk);
      return;
    }
    if (capFps && lastRender && now - lastRender < 12.5) return;
    const dt = lastNow ? (now - lastNow) / 1000 : 1 / 60;
    if (lastRender) meter.gap(now - lastRender);
    lastNow = now;
    lastRender = now;
    clock += Math.min(dt, 0.1);
    const t0 = performance.now();
    const finished = choreo.update(dt, clock);
    render();
    meter.cpu(performance.now() - t0);
    meter.poll();
    if (finished) ackFrame = true;
  };

  const start = () => {
    if (running || !isReady || disposed) return;
    running = true;
    lastNow = 0;
    lastRender = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // ---------- préparation : shaders, textures, chemins du visage ----------
  const warm = async () => {
    const ok = await prepareRig(
      rig,
      renderer,
      scene,
      camera,
      render,
      () => disposed,
    );
    if (!ok) return;
    await rehearse();
    if (disposed) return;
    rig.head.face.resetCache();
    renderer.clear(); // la toile repart transparente
    isReady = true;
    if (choreo.visible) start();
  };
  // Répétition silencieuse d'une séance complète (fenêtre encore cachée), par petits paquets d'images : tous les
  // chemins de rendu et de mise à jour du visage servent une fois avant la première vraie dictée. Une vraie
  // dictée qui arrive entre-temps l'interrompt.
  const rehearse = async () => {
    const sim = new Choreography(rig, 11);
    const voice = (i: number) =>
      Array.from({ length: 16 }, () => 0.3 + (i % 6 < 3 ? 0.45 : 0));
    const steps: [number, (i: number, t: number) => void][] = [
      [1, (_, t) => sim.show("recording", t)],
      [10, () => {}],
      [1, (_, t) => sim.ready(t)],
      [24, (i) => sim.levels(voice(i))],
      [1, (_, t) => sim.show("transcribing", t)],
      [34, () => {}],
      [1, (_, t) => sim.show("processing", t)],
      [24, () => {}],
      [1, (_, t) => sim.hide("done", t)],
      [22, () => {}],
      [1, (_, t) => sim.show("transcribing", t)],
      [4, () => {}],
      [1, (_, t) => sim.hide("done", t)],
      [50, () => {}],
      [1, (_, t) => sim.show("recording", t)],
      [8, () => {}],
      [1, (_, t) => sim.hide("cancel", t)],
      [22, () => {}],
    ];
    let t = 0;
    let n = 0;
    for (const [count, fn] of steps) {
      for (let i = 0; i < count; i++) {
        if (disposed || choreo.visible) {
          sim.reset();
          return;
        }
        fn(i, t);
        t += 1 / 30;
        sim.update(1 / 30, t);
        render();
        if (++n % 12 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }
    sim.reset();
  };
  const ready = warm();

  return {
    canvas,
    ready,
    show(state) {
      if (exitPending) {
        // relance pendant la sortie : il revient, la fenêtre reste affichée
        exitPending = false;
        ackFrame = false;
        exitToken = undefined;
      }
      choreo.show(state, clock);
      start();
    },
    micReady() {
      choreo.ready(clock);
    },
    levels(l) {
      choreo.levels(l);
    },
    error() {
      choreo.error();
    },
    hide(reason, token) {
      if (!choreo.visible || !isReady) {
        // rien à l'écran : la fenêtre peut être cachée tout de suite
        opts.onExitDone?.(token);
        return;
      }
      exitPending = true;
      exitToken = token;
      choreo.hide(reason, clock);
      start();
    },
    abort() {
      exitPending = false;
      ackFrame = false;
      exitToken = undefined;
      choreo.reset();
      stop();
      if (isReady) render(); // image vide
    },
    stats(reset = false) {
      return meter.stats(reset);
    },
    dispose() {
      disposed = true;
      stop();
      context.dispose();
      rig.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export { HS };
