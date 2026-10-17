/* Le personnage de J’écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* La scène du personnage dans la fenêtre principale (le perso au centre de l'accueil). Même personnage, mêmes
   lumières et même chorégraphie que la fenêtre d'enregistrement (stage.ts) ; ici il reste à l'écran : repos
   vivant entre deux dictées (rest.ts), et les mêmes moments pendant une dictée (écoute, frappe, chuchotement).

   - La toile remplit son conteneur ; le cadrage garde toujours visibles la tête et ses sauts, les mains levées,
     les arcs sonores à droite et le clavier en dessous, quelle que soit la forme du conteneur.
   - « compact » le rapetisse dans son conteneur, en douceur.
   - Budget bas (fenêtre ouverte longtemps) : résolution fixée à 2 pixels par pixel CSS (plafond), 30 images par
     seconde quand rien ne bouge beaucoup, 60 sinon ; boucle arrêtée quand la page est cachée ou en pause. */

import * as THREE from "three";
import { Choreography } from "./choreography";
import { createFrameMeter } from "./meter";
import type { FrameStats } from "./meter";
import type { PersoLookAt, PersoMood } from "./Perso";
import { Rest } from "./rest";
import type { ActName } from "./rest";
import { addLights, createRig, prepareRig, watchContextLoss } from "./rig";

/** Résolution de rendu maximale (pixels par pixel CSS). */
export const HOME_PIXEL_RATIO_CAP = 2;
/** Ce que le cadrage montre toujours (unités de la scène, centre de la tête à l'origine, rayon 0,88). */
const SAFE = { left: -2.2, right: 2.2, bottom: -1.08, top: 1.56 };
const FOV = 24;
/** Taille du perso rangé sur le côté (réglages ouverts), et durée de la transition (s). */
const COMPACT_SCALE = 0.74;
const COMPACT_TIME = 0.5;
/** Cadence calme (30 i/s) : tête plus lente que ces seuils (rad/s, unités/s) depuis au moins CALM_HOLD s. */
const CALM_ROT = 0.5;
const CALM_POS = 0.25;
const CALM_HOLD = 0.3;
/** Après une absence de la fenêtre au moins aussi longue (s), il salue à son retour. */
const GREET_AFTER = 20;

export interface HomeCharacterOptions {
  /** Mesure aussi le temps GPU de chaque image. */
  measureGpu?: boolean;
  /** Graine des aléas (tests : mêmes événements, mêmes images). */
  seed?: number;
  /** Salue à la première apparition (défaut : vrai). */
  greet?: boolean;
}

export interface HomeCharacter {
  readonly canvas: HTMLCanvasElement;
  /** Shaders et textures prêts, perso à l'écran. */
  readonly ready: Promise<void>;
  setMood(m: PersoMood): void;
  /** Niveaux du micro (16 bandes, 0..1) pendant l'écoute. */
  levels(l: ArrayLike<number> | null | undefined): void;
  setLookAt(l: PersoLookAt): void;
  /** `instant` : sans transition (premier affichage). */
  setCompact(c: boolean, instant?: boolean): void;
  setPaused(p: boolean): void;
  /** Position du curseur dans la fenêtre (px CSS ; peut être hors de la fenêtre). */
  pointer(x: number, y: number): void;
  /** Le point (px CSS dans la fenêtre) est-il sur le perso ? */
  hit(x: number, y: number): boolean;
  /** Clic sur le perso. */
  poke(): void;
  /** Pour les tests : joue une saynète, ou l'endort. */
  play(name: ActName): void;
  sleep(): void;
  /** Mesures ; `calm` : part des images rendues au rythme calme (30 i/s). */
  stats(reset?: boolean): FrameStats & { calm: number };
  /** Pour les tests : pose de la dernière image (échelle, tête, mains), pour détecter les sauts. */
  probe(): number[];
  dispose(): void;
}

export function createHomeCharacter(
  canvas: HTMLCanvasElement,
  opts: HomeCharacterOptions = {},
): HomeCharacter {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "low-power",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  // 2 pixels par pixel CSS : suréchantillonnage 2 x 2 à 100 % (bords nets de l'encoche et des traits), résolution
  // native à 200 %, plafond au-delà
  renderer.setPixelRatio(HOME_PIXEL_RATIO_CAP);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
  addLights(scene);
  const world = new THREE.Group();
  scene.add(world);
  const rig = createRig(renderer);
  world.add(rig.root);
  // filtrage anisotrope maximal : près du pôle (haut de la fente entre les cornes), la texture est très comprimée
  // et le test alpha sur des niveaux de mipmap moyennés dessinait un fin pointillé rouge en travers de la fente
  const aniso = renderer.capabilities.getMaxAnisotropy();
  rig.head.face.headTex.anisotropy = aniso;
  rig.head.face.alphaTex.anisotropy = aniso;

  const choreo = new Choreography(rig, opts.seed ?? 5);
  choreo.idleMode = true;
  const rest = new Rest(opts.seed ?? 3);
  choreo.rest = rest;
  const meter = createFrameMeter(renderer, rig.head.face, !!opts.measureGpu);
  const context = watchContextLoss(canvas, renderer, scene, camera, rig, () =>
    render(),
  );

  // ---------- état ----------
  let mood: PersoMood = "pret";
  let compact = false;
  let compactK = 0;
  let compactFrom = 0;
  let compactAt = -1;
  let paused = false;
  let hidden = document.visibilityState === "hidden";
  let hiddenAt = hidden ? performance.now() : 0;
  let micReady = false;
  let listenAt = 0;
  let greetAt = opts.greet === false ? -1 : 0.55;
  let cursor: { x: number; y: number } | null = null;

  // ---------- boucle ----------
  let raf = 0;
  let running = false;
  let lastNow = 0;
  let lastRender = 0;
  let clock = 0;
  let isReady = false;
  let disposed = false;
  let calmFrames = 0;
  let frames = 0;

  const render = () => {
    if (context.lost() || !isReady) return;
    meter.render(scene, camera);
  };

  // le centre de la tête au repos, à l'écran (px CSS dans la fenêtre)
  const _p = new THREE.Vector3();
  const _q = new THREE.Vector3();
  const toClient = (v: THREE.Vector3, r: DOMRect) => {
    v.project(camera);
    v.x = r.left + ((v.x + 1) / 2) * r.width;
    v.y = r.top + ((1 - v.y) / 2) * r.height;
    return v;
  };

  // calme : au repos, sans saynète, rien qui apparaît, tête lente (mesurée sur les dernières images)
  let calmFor = 0;
  const prevRot = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const measureCalm = (dt: number) => {
    const g = rig.head.group;
    const rot =
      Math.abs(g.rotation.x - prevRot.x) +
      Math.abs(g.rotation.y - prevRot.y) +
      Math.abs(g.rotation.z - prevRot.z);
    const pos = g.position.distanceTo(prevPos);
    prevRot.set(g.rotation.x, g.rotation.y, g.rotation.z);
    prevPos.copy(g.position);
    const quiet =
      choreo.resting &&
      !choreo.busy &&
      rest.calm &&
      compactAt < 0 &&
      rot < CALM_ROT * dt &&
      pos < CALM_POS * dt;
    calmFor = quiet ? calmFor + dt : 0;
  };

  const step = (dt: number) => {
    if (compactAt >= 0) {
      // transition douce (départ et arrivée en douceur)
      const u = Math.min(1, (clock - compactAt) / COMPACT_TIME);
      const e = u * u * u * (u * (u * 6 - 15) + 10);
      compactK = compactFrom + ((compact ? 1 : 0) - compactFrom) * e;
      if (u >= 1) compactAt = -1;
      world.scale.setScalar(1 - (1 - COMPACT_SCALE) * compactK);
    }
    if (cursor) {
      const r = canvas.getBoundingClientRect();
      const c = toClient(_p.set(0, 0, 0), r);
      rest.cursor(cursor.x - c.x, cursor.y - c.y, clock);
    } else rest.cursor(null, 0, clock);
    if (greetAt >= 0 && clock >= greetAt) {
      greetAt = -1;
      if (choreo.resting && mood === "pret") rest.play("salue", clock);
    }
    // l'écoute commence par l'armement ; il tend l'oreille aux premiers niveaux du micro (ou après 0,35 s)
    if (mood === "ecoute" && !micReady && clock - listenAt > 0.35) {
      micReady = true;
      choreo.ready(clock);
    }
    choreo.update(dt, clock);
  };

  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const calm = calmFor >= CALM_HOLD;
    if (lastRender && now - lastRender < (calm ? 30 : 12.5)) return;
    const dt = Math.min(lastNow ? (now - lastNow) / 1000 : 1 / 60, 0.1);
    if (lastRender) meter.gap(now - lastRender);
    lastNow = now;
    lastRender = now;
    clock += dt;
    frames++;
    if (calm) calmFrames++;
    const t0 = performance.now();
    step(dt);
    render();
    measureCalm(dt);
    meter.cpu(performance.now() - t0);
    meter.poll();
  };

  const start = () => {
    if (running || !isReady || disposed || paused || hidden) return;
    running = true;
    lastNow = 0;
    lastRender = 0;
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  // ---------- taille ----------
  let curW = 0;
  let curH = 0;
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth));
    const h = Math.max(1, Math.round(canvas.clientHeight));
    if (w === curW && h === curH) return;
    curW = w;
    curH = h;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const needH = SAFE.top - SAFE.bottom;
    const viewH = Math.max(needH, (SAFE.right - SAFE.left) / aspect);
    const dist = viewH / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));
    const yc = (SAFE.top + SAFE.bottom) / 2;
    camera.aspect = aspect;
    camera.position.set(0, yc + 0.6, dist);
    camera.lookAt(0, yc, 0);
    camera.updateProjectionMatrix();
    // la toile vient d'être vidée : nouvelle image tout de suite (jamais d'image vide ou étirée)
    render();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // ---------- page cachée ----------
  const onVisibility = () => {
    const h = document.visibilityState === "hidden";
    if (h === hidden) return;
    hidden = h;
    if (h) {
      hiddenAt = performance.now();
      stop();
    } else {
      if (performance.now() - hiddenAt > GREET_AFTER * 1000)
        greetAt = clock + 0.4;
      start();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // ---------- humeurs ----------
  const applyMood = (m: PersoMood) => {
    if (m === "ecoute") {
      micReady = false;
      listenAt = clock;
      choreo.show("recording", clock);
    } else if (m === "frappe") choreo.show("transcribing", clock);
    else if (m === "chuchote") choreo.show("processing", clock);
    else {
      rest.setMood(m, clock);
      if (choreo.dictating) {
        // fin de la dictée : sourire (ou haussement si rien n'a été écrit, « oups » en cas d'erreur), puis repos
        if (m === "erreur") choreo.error();
        choreo.hide("done", clock);
      } else if (m === "erreur") choreo.oops(clock);
    }
  };

  // ---------- préparation ----------
  const warm = async () => {
    const ok = await prepareRig(
      rig,
      renderer,
      scene,
      camera,
      () => {
        if (!context.lost()) renderer.render(scene, camera);
      },
      () => disposed,
      [
        { eyes: "half", lid: 0.6, mouth: "o", open: 0.5 },
        { eyes: "squint", mouth: "o", open: 0.55 },
        { eyes: "happy", mouth: "o", open: 0.12 },
        { eyes: "half", lid: 0.42, lidTilt: -9, mouth: "zig" },
        { eyes: "open", blink: 0, mouth: "o", open: 0.08 },
        { eyes: "open", lift: 0.8, mouth: "o", open: 0.12 },
      ],
    );
    if (!ok) return;
    rig.head.face.resetCache();
    renderer.clear(); // la toile repart transparente, dans la même tâche (jamais affichée pleine)
    isReady = true;
    choreo.appear(clock);
    if (mood !== "pret") applyMood(mood);
    render();
    canvas.dataset.ready = "1";
    start();
  };
  const ready = warm();

  return {
    canvas,
    ready,
    setMood(m) {
      if (m === mood) return;
      mood = m;
      rest.activity(clock);
      if (isReady) applyMood(m);
      start();
    },
    levels(l) {
      if (!l || mood !== "ecoute" || !isReady) return;
      if (!micReady) {
        micReady = true;
        choreo.ready(clock);
      }
      choreo.levels(l);
    },
    setLookAt(l) {
      if (rest.gaze === l) return;
      rest.gaze = l;
      rest.activity(clock);
    },
    setCompact(c, instant = false) {
      if (c === compact && !instant) return;
      compact = c;
      rest.compact = c;
      if (instant) {
        compactK = c ? 1 : 0;
        compactAt = -1;
        world.scale.setScalar(1 - (1 - COMPACT_SCALE) * compactK);
      } else {
        compactFrom = compactK;
        compactAt = clock;
        rest.activity(clock);
        start();
      }
    },
    setPaused(p) {
      paused = p;
      if (p) stop();
      else start();
    },
    pointer(x, y) {
      cursor = cursor ?? { x, y };
      cursor.x = x;
      cursor.y = y;
    },
    hit(x, y) {
      if (!isReady) return false;
      const r = canvas.getBoundingClientRect();
      _p.setFromMatrixPosition(rig.head.group.matrixWorld);
      _q.copy(_p);
      _q.x += rig.head.group.scale.y * world.scale.x * 1.05;
      const c = toClient(_p, r);
      const e = toClient(_q, r);
      return Math.hypot(x - c.x, y - c.y) <= Math.abs(e.x - c.x);
    },
    poke() {
      if (!isReady) return;
      if (choreo.resting) rest.poke(clock);
      start();
    },
    play(name) {
      rest.play(name, clock);
    },
    sleep() {
      rest.sleepNow(clock);
    },
    probe() {
      const g = rig.head.group;
      const out = [
        world.scale.x,
        rig.root.scale.x,
        rig.root.scale.y,
        g.position.x,
        g.position.y,
        g.rotation.x,
        g.rotation.y,
        g.rotation.z,
        g.scale.x,
        g.scale.y,
      ];
      for (const h of rig.hands)
        out.push(
          h.visible ? h.scale.x : 0,
          h.position.x,
          h.position.y,
          h.position.z,
        );
      return out;
    },
    stats(reset = false) {
      const s = {
        ...meter.stats(reset),
        calm: frames ? calmFrames / frames : 0,
      };
      if (reset) calmFrames = frames = 0;
      return s;
    },
    dispose() {
      disposed = true;
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      context.dispose();
      rig.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
