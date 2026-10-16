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
import { Choreography, HEAD_Y } from "./choreography";
import type { CharacterState, ExitReason } from "./choreography";
import { createDecor } from "./decor";
import { createHandGeometry, createHead, HS } from "./head";
import type { FaceState } from "./face";

/** Taille de la scène, en pixels CSS. La fenêtre native (overlay.rs) a exactement cette taille. */
export const STAGE_W = 224;
export const STAGE_H = 144;
/** Résolution de rendu (plafond du devicePixelRatio). */
export const PIXEL_RATIO_CAP = 2;

/** Cadrage, en unités de la scène (rayon de la tête = 0,88), centre de la tête à l'origine. */
const VIEW_BOTTOM = -1.1;
const VIEW_TOP = 2.03;
const FOV = 24;

export interface FrameStats {
  frames: number;
  /** Temps CPU par image (mise à jour + envoi du rendu), en ms. */
  cpuAvg: number;
  cpuP95: number;
  cpuMax: number;
  /** Intervalle entre deux images rendues, en ms. */
  intervalAvg: number;
  intervalP95: number;
  intervalMax: number;
  /** Temps GPU par image (si mesurable), en ms. */
  gpuAvg: number | null;
  gpuP95: number | null;
  gpuMax: number | null;
  /** Repeints du visage. */
  faceDraws: number;
}

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
  /** Mesure le temps GPU de chaque image (EXT_disjoint_timer_query_webgl2), pour le banc d'essai. */
  measureGpu?: boolean;
  /** Limite la cadence à ~60 i/s sur les écrans plus rapides (défaut : vrai). */
  capFps?: boolean;
}

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
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

  // mêmes lumières que la scène d'origine, placées pareil par rapport à la tête
  scene.add(new THREE.HemisphereLight(0xfff4ee, 0x7a5a58, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2.5, 5, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xff2030, 18, 12);
  rim.position.set(3.45, 1.8, -3.65);
  scene.add(rim);

  // le personnage : pivot du pop au bas de la tête
  const root = new THREE.Group();
  root.position.set(0, -HEAD_Y, 0);
  scene.add(root);
  const head = createHead(renderer);
  root.add(head.group);
  const handMat = new THREE.MeshStandardMaterial({
    color: 0xf0101c,
    roughness: 0.62,
    metalness: 0,
  });
  const handGeo = createHandGeometry();
  const hands: [THREE.Mesh, THREE.Mesh] = [
    new THREE.Mesh(handGeo, handMat),
    new THREE.Mesh(handGeo, handMat),
  ];
  hands.forEach((h) => {
    h.visible = false;
    root.add(h);
  });
  const decor = createDecor();
  root.add(decor.group);
  head.group.position.set(0, HEAD_Y, 0);

  const choreo = new Choreography({ root, head, hands, decor });

  // ---------- mesures ----------
  const N = 1200;
  const cpu = new Float32Array(N);
  const gap = new Float32Array(N);
  const gpu = new Float32Array(N);
  let nCpu = 0;
  let nGap = 0;
  let nGpu = 0;
  let faceDraws = 0;
  const drawFace = head.face.draw;
  head.face.draw = (s: FaceState) => {
    const r = drawFace(s);
    if (r) faceDraws++;
    return r;
  };
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const timer = opts.measureGpu
    ? (gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null)
    : null;
  const pendingQ: WebGLQuery[] = [];
  const pollGpu = () => {
    if (!timer) return;
    while (pendingQ.length) {
      const q = pendingQ[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      pendingQ.shift();
      const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
      if (!disjoint)
        gpu[nGpu++ % N] = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(q);
    }
  };

  // ---------- boucle ----------
  let raf = 0;
  let running = false;
  let lastNow = 0;
  let lastRender = 0;
  let clock = 0;
  let lost = false;
  let isReady = false;
  let disposed = false;
  let exitToken: unknown = undefined;
  let exitPending = false;
  let ackFrame = false;
  const capFps = opts.capFps !== false;

  const render = () => {
    if (lost) return;
    let q: WebGLQuery | null = null;
    if (timer && pendingQ.length < 8) {
      q = gl.createQuery();
      if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
    }
    renderer.render(scene, camera);
    if (q && timer) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      pendingQ.push(q);
    }
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
    if (lastRender) gap[nGap++ % N] = now - lastRender;
    lastNow = now;
    lastRender = now;
    clock += Math.min(dt, 0.1);
    const t0 = performance.now();
    const finished = choreo.update(dt, clock);
    render();
    cpu[nCpu++ % N] = performance.now() - t0;
    pollGpu();
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
  const warmFaces: Partial<FaceState>[] = [
    { eyes: "wide", lift: 1, mouth: "o", open: 0.3 },
    { eyes: "open", lift: 0.5, mouth: "grin", open: 0.04, ex: 54 },
    { eyes: "half", lid: 0.5, mouth: "whistle", open: 0.4, mx: -44 },
    {
      eyes: "half",
      lid: 0.34,
      lidTilt: -10,
      sly: true,
      mouth: "whisper",
      open: 0.4,
      mx: 112,
    },
    { eyes: "happy", mouth: "grin", open: 0.72 },
    { eyes: "squint", brows: 0.9, mouth: "zig" },
    { eyes: "open", brows: 0.9, mouth: "zig" },
    { eyes: "open", mouth: "grin", open: 0.04 },
  ];
  const baseFace: FaceState = {
    eyes: "open",
    blink: 1,
    lid: 0,
    lidTilt: 0,
    ex: 0,
    ey: 0,
    brows: 0,
    lift: 0,
    sly: false,
    mouth: "grin",
    open: 0.04,
    mx: 0,
  };
  const setAllVisible = (on: boolean) => {
    root.visible = on;
    root.scale.setScalar(on ? 1 : 0.0001);
    hands.forEach((h, i) => {
      h.visible = on;
      h.position.set(i ? 1.3 : -1.3, HEAD_Y, 0);
      if (h.morphTargetInfluences) h.morphTargetInfluences[0] = 0.5;
    });
    decor.arcs.mesh.visible = on;
    decor.arcs.alpha.fill(on ? 0.5 : 0);
    decor.notes.forEach((m) => {
      m.visible = on;
      m.material.opacity = on ? 0.5 : 0;
    });
    decor.bubble.visible = on;
    decor.drop.visible = on;
  };
  const warm = async () => {
    for (const f of warmFaces) head.face.draw({ ...baseFace, ...f });
    head.face.draw(baseFace);
    setAllVisible(true);
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      renderer.compile(scene, camera);
    }
    if (disposed) return;
    render(); // envoie géométries et textures au GPU
    setAllVisible(false);
    await rehearse();
    if (disposed) return;
    head.face.resetCache();
    renderer.clear(); // la toile repart transparente
    isReady = true;
    if (choreo.visible) start();
  };
  // Répétition silencieuse d'une séance complète (fenêtre encore cachée), par petits paquets d'images : tous les
  // chemins de rendu et de mise à jour du visage servent une fois avant la première vraie dictée. Une vraie
  // dictée qui arrive entre-temps l'interrompt.
  const rehearse = async () => {
    const sim = new Choreography({ root, head, hands, decor }, 11);
    const voice = (i: number) =>
      Array.from({ length: 16 }, () => 0.3 + (i % 6 < 3 ? 0.45 : 0));
    const steps: [number, (i: number, t: number) => void][] = [
      [1, (_, t) => sim.show("recording", t)],
      [10, () => {}],
      [1, (_, t) => sim.ready(t)],
      [24, (i) => sim.levels(voice(i))],
      [1, (_, t) => sim.show("transcribing", t)],
      [24, () => {}],
      [1, (_, t) => sim.show("processing", t)],
      [24, () => {}],
      [1, (_, t) => sim.hide("done", t)],
      [22, () => {}],
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

  // ---------- perte de contexte ----------
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
    head.face.reupload();
    decor.textures.forEach((t) => (t.needsUpdate = true));
    renderer.compileAsync(scene, camera).catch(() => {});
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const pct = (a: Float32Array, n: number, p: number) => {
    const m = Math.min(n, N);
    if (!m) return 0;
    const s = Array.from(a.subarray(0, m)).sort((x, y) => x - y);
    return s[Math.min(m - 1, Math.floor(p * m))];
  };
  const avg = (a: Float32Array, n: number) => {
    const m = Math.min(n, N);
    if (!m) return 0;
    let s = 0;
    for (let i = 0; i < m; i++) s += a[i];
    return s / m;
  };

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
      const s: FrameStats = {
        frames: nCpu,
        cpuAvg: avg(cpu, nCpu),
        cpuP95: pct(cpu, nCpu, 0.95),
        cpuMax: pct(cpu, nCpu, 1),
        intervalAvg: avg(gap, nGap),
        intervalP95: pct(gap, nGap, 0.95),
        intervalMax: pct(gap, nGap, 1),
        gpuAvg: timer ? avg(gpu, nGpu) : null,
        gpuP95: timer ? pct(gpu, nGpu, 0.95) : null,
        gpuMax: timer ? pct(gpu, nGpu, 1) : null,
        faceDraws,
      };
      if (reset) {
        nCpu = nGap = nGpu = 0;
        faceDraws = 0;
      }
      return s;
    },
    dispose() {
      disposed = true;
      stop();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      head.dispose();
      handGeo.dispose();
      handMat.dispose();
      decor.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export { HS };
