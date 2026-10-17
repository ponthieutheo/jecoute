/* Le personnage de J’écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Mesures des deux scènes : temps CPU par image, intervalle entre deux images rendues, temps GPU (requêtes
   EXT_disjoint_timer_query_webgl2, pour les bancs d'essai) et repeints du visage. */

import * as THREE from "three";
import type { Face, FaceState } from "./face";

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
  /** Repeints du visage, et leur temps moyen (ms). */
  faceDraws: number;
  faceMs: number;
}

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const N = 1200;

export function createFrameMeter(
  renderer: THREE.WebGLRenderer,
  face: Face,
  measureGpu: boolean,
) {
  const cpu = new Float32Array(N);
  const gap = new Float32Array(N);
  const gpu = new Float32Array(N);
  let nCpu = 0;
  let nGap = 0;
  let nGpu = 0;
  let faceDraws = 0;
  let faceTime = 0;
  const drawFace = face.draw;
  face.draw = (s: FaceState) => {
    const t0 = performance.now();
    const r = drawFace(s);
    if (r) {
      faceDraws++;
      faceTime += performance.now() - t0;
    }
    return r;
  };
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const timer = measureGpu
    ? (gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null)
    : null;
  const pendingQ: WebGLQuery[] = [];

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
    /** Rend une image, mesurée sur le GPU si demandé. */
    render(scene: THREE.Scene, camera: THREE.Camera) {
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
    },
    /** Relève les mesures GPU arrivées. */
    poll() {
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
    },
    cpu(ms: number) {
      cpu[nCpu++ % N] = ms;
    },
    gap(ms: number) {
      gap[nGap++ % N] = ms;
    },
    stats(reset = false): FrameStats {
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
        faceMs: faceDraws ? faceTime / faceDraws : 0,
      };
      if (reset) {
        nCpu = nGap = nGpu = 0;
        faceDraws = 0;
        faceTime = 0;
      }
      return s;
    },
  };
}
