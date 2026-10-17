/* Le personnage de J’écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Visage peint du personnage : le logo projeté sur la sphère de la tête (vu de face = le logo exact).
   Yeux, sourcils et bouche sont peints dans une toile 2D puis reportés sur la texture équirectangulaire de la
   sphère. Seuls les texels qui peuvent changer sont recalculés, et seul leur rectangle est renvoyé au GPU.

   Repris du visage d'origine (mêmes tracés, même noir, même rouge), sans les accessoires. Formes ajoutées pour
   la fenêtre d'enregistrement : yeux mi-clos (« half »), sourcils levés (« lift »), sourcil complice (« sly »),
   bouche qui chuchote (« whisper »), petite bouche crispée (« zig » réduite). Sourcils légèrement
   froncés quand il tape (« focus »). */

import * as THREE from "three";

export type EyeMode = "open" | "wide" | "happy" | "half" | "squint";
export type MouthMode = "grin" | "o" | "whisper" | "zig";

export interface FaceState {
  eyes: EyeMode;
  /** 1 = yeux ouverts, 0 = fermés (clignement). */
  blink: number;
  /** Yeux mi-clos : part de l'œil cachée par la paupière (0..1). */
  lid: number;
  /** Yeux mi-clos : pente de la paupière (unités du logo, + = coins extérieurs plus bas). */
  lidTilt: number;
  /** Regard (unités du logo, + = vers la droite de l'écran / vers le bas). */
  ex: number;
  ey: number;
  /** Sourcils inquiets (0..1). */
  brows: number;
  /** Sourcils levés, attentifs (0..1). */
  lift: number;
  /** Un sourcil levé : regard complice. */
  sly: boolean;
  /** Sourcils froncés : concentré (il tape). */
  focus: boolean;
  mouth: MouthMode;
  /** Ouverture de la bouche (0..1) : sourire du logo, « o », chuchotement. */
  open: number;
  /** Décalage horizontal de la bouche (unités du logo). */
  mx: number;
}

export interface Face {
  headTex: THREE.DataTexture;
  alphaTex: THREE.DataTexture;
  /** Repeint le visage si l'expression a changé ; renvoie vrai s'il a été repeint. */
  draw(s: FaceState): boolean;
  /** Oublie la dernière expression (le prochain draw repeint). */
  resetCache(): void;
  /** Après une perte du contexte WebGL : tout renvoyer au GPU. */
  reupload(): void;
  dispose(): void;
  liveTexels: number;
}

export const INK = "#120506";
const RED = "#f0101c";

export function createFace(renderer?: THREE.WebGLRenderer): Face {
  const FS = 512;
  const k = FS / 1254;
  const face = document.createElement("canvas");
  face.width = face.height = FS;
  const fctx = face.getContext("2d", { willReadFrequently: true });
  if (!fctx) throw new Error("toile 2D indisponible");
  const TW = 1024;
  const TH = 512;
  // texture de la sphère, rangée dans l'ordre du GPU (ligne 0 = bas de l'image)
  const data = new Uint8ClampedArray(TW * TH * 4);
  const map = new Int32Array(TW * TH);
  const cut = new Uint8Array(TW * TH);
  const COS = new Float64Array(TW);
  const SIN = new Float64Array(TW);
  for (let c = 0; c < TW; c++) {
    const ph = ((c + 0.5) / TW) * Math.PI * 2;
    COS[c] = Math.cos(ph);
    SIN[c] = Math.sin(ph);
  }
  for (let r = 0; r < TH; r++) {
    const th = ((r + 0.5) / TH) * Math.PI;
    const st = Math.sin(th);
    const y = Math.cos(th);
    for (let c = 0; c < TW; c++) {
      const x = -COS[c] * st;
      const z = SIN[c] * st;
      const i = r * TW + c;
      // l'encoche entre les cornes : un disque prolongé d'une fente verticale, qui traverse la tête
      cut[i] =
        x * x + (y - 0.7044) ** 2 < 0.297 ** 2 ||
        (Math.abs(x) < 0.186 && y > 0.7044)
          ? 1
          : 0;
      if (z > 0) {
        const px = Math.round((627 + x * 565) * k);
        const py = Math.round((660 - y * 565) * k);
        map[i] = px >= 0 && px < FS && py >= 0 && py < FS ? py * FS + px : -1;
      } else map[i] = -1;
    }
  }
  // seuls ces texels peuvent changer (sourcils, yeux, bouche)
  const fx0 = Math.floor(200 * k);
  const fx1 = Math.ceil(1054 * k);
  const fy0 = Math.floor(395 * k);
  const fy1 = Math.ceil(1000 * k);
  const RW = fx1 - fx0 + 1;
  const RH = fy1 - fy0 + 1;
  const ls: number[] = [];
  const ld: number[] = [];
  let c0 = TW;
  let c1 = -1;
  let g0 = TH;
  let g1 = -1;
  for (let i = 0; i < TW * TH; i++) {
    const m = map[i];
    if (m < 0 || cut[i]) continue;
    const px = m % FS;
    const py = (m / FS) | 0;
    if (px >= fx0 && px <= fx1 && py >= fy0 && py <= fy1) {
      const r = (i / TW) | 0;
      const c = i % TW;
      const g = TH - 1 - r;
      ls.push(((py - fy0) * RW + px - fx0) * 4);
      ld.push((g * TW + c) * 4);
      if (c < c0) c0 = c;
      if (c > c1) c1 = c;
      if (g < g0) g0 = g;
      if (g > g1) g1 = g;
    }
  }
  const LS = Int32Array.from(ls);
  const LD = Int32Array.from(ld);
  const NLIVE = LS.length;
  const RECT = new THREE.Box2(
    new THREE.Vector2(c0, g0),
    new THREE.Vector2(c1 + 1, g1 + 1),
  );
  const RPOS = new THREE.Vector2(c0, g0);

  const fixedTex = (arr: Uint8ClampedArray) => {
    const t = new THREE.DataTexture(
      arr,
      TW,
      TH,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.unpackAlignment = 4;
    t.needsUpdate = true;
    return t;
  };
  // texture d'alpha (l'encoche) pour l'intérieur de la tête
  const alA = new Uint8ClampedArray(TW * TH * 4);
  for (let i = 0; i < TW * TH; i++) {
    const v = cut[i] ? 0 : 255;
    const o = ((TH - 1 - ((i / TW) | 0)) * TW + (i % TW)) * 4;
    alA[o] = alA[o + 1] = alA[o + 2] = v;
    alA[o + 3] = 255;
  }
  const alphaTex = fixedTex(alA);

  // sphère rouge (240, 16, 28), encoche transparente
  for (let i = 0, n = TW * TH; i < n; i++) {
    const p = ((TH - 1 - ((i / TW) | 0)) * TW + (i % TW)) * 4;
    if (cut[i]) {
      data[p + 3] = 0;
      continue;
    }
    data[p] = 240;
    data[p + 1] = 16;
    data[p + 2] = 28;
    data[p + 3] = 255;
  }
  const headTex = new THREE.DataTexture(
    data,
    TW,
    TH,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  headTex.colorSpace = THREE.SRGBColorSpace;
  headTex.magFilter = THREE.LinearFilter;
  headTex.minFilter = THREE.LinearMipmapLinearFilter;
  headTex.generateMipmaps = true;
  headTex.anisotropy = 4;
  headTex.unpackAlignment = 4;
  headTex.needsUpdate = true;

  // renvoie au GPU le seul rectangle vivant (la texture entière la première fois)
  let fullUpload = true;
  const upload = () => {
    if (!renderer || fullUpload) {
      headTex.needsUpdate = true;
      fullUpload = false;
      return;
    }
    renderer.copyTextureToTexture(headTex, headTex, RECT, RPOS);
  };

  // tracés du logo d'origine
  const BROWS = new Path2D("M392 505Q452 470 528 452M726 452Q802 470 862 505");
  const THINK_UP = new Path2D("M386 478Q458 400 540 446");
  const HAPPY = new Path2D("M405 690Q466 590 527 690M728 690Q789 590 850 690");
  const SQUINT = new Path2D("M412 585L524 640L412 695M842 585L730 640L842 695");
  const ZIG = new Path2D(
    "M430 866L478 834L526 870L574 834L626 870L678 834L730 870L778 834L824 866",
  );
  // ajouts : sourcils levés en arc (attentif)
  const LIFT = new Path2D("M398 492Q462 432 536 470M718 470Q792 432 856 492");
  // sourcils légèrement froncés, bas sur les yeux (concentré, pas fâché)
  const FOCUS = new Path2D("M400 492Q466 494 530 510M724 510Q788 494 854 492");
  // contour de la bouche du logo (crocs compris), échantillonné pour pouvoir la refermer progressivement
  const MOUTH_PTS = (() => {
    const P: [number, number][] = [
      [262, 758],
      [352, 798],
      [374, 905],
      [428, 826],
    ];
    const q = (
      x0: number,
      y0: number,
      cx: number,
      cy: number,
      x1: number,
      y1: number,
    ) => {
      for (let i = 1; i <= 14; i++) {
        const t = i / 14;
        const u = 1 - t;
        P.push([
          u * u * x0 + 2 * u * t * cx + t * t * x1,
          u * u * y0 + 2 * u * t * cy + t * t * y1,
        ]);
      }
    };
    q(428, 826, 627, 862, 824, 826);
    P.push([878, 905], [898, 798], [990, 758]);
    q(990, 758, 936, 885, 790, 940);
    q(790, 940, 627, 990, 464, 940);
    q(464, 940, 318, 885, 262, 758);
    return P;
  })();
  const TOP_N = MOUTH_PTS.findIndex(([x, y]) => x === 990 && y === 758);
  const TOP = MOUTH_PTS.slice(0, TOP_N + 1);
  const LIP = TOP.filter(([, y]) => y !== 905);
  const lipY = (x: number) => {
    for (let j = 1; j < LIP.length; j++)
      if (x <= LIP[j][0]) {
        const [x0, y0] = LIP[j - 1];
        const [x1, y1] = LIP[j];
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
      }
    return 758;
  };
  const FANGS: [number, number][][] = [
    [
      [352, 798],
      [374, 905],
      [428, 826],
    ],
    [
      [824, 826],
      [878, 905],
      [898, 798],
    ],
  ];

  const pill = (x: number, y: number, w: number, h: number) => {
    fctx.beginPath();
    fctx.roundRect(x, y, w, h, Math.min(w / 2, h / 2));
  };

  let faceKey = "";
  function drawFace(s: FaceState): boolean {
    const blink = Math.max(0, Math.min(1, s.blink));
    const open = Math.max(0, Math.min(1, s.open));
    const key = `${s.eyes}|${blink.toFixed(2)}|${s.lid.toFixed(2)}|${s.lidTilt.toFixed(0)}|${s.ex.toFixed(0)}|${s.ey.toFixed(0)}|${s.brows.toFixed(1)}|${s.lift.toFixed(2)}|${s.sly}|${s.focus}|${s.mouth}|${open.toFixed(3)}|${s.mx.toFixed(0)}`;
    if (key === faceKey) return false;
    faceKey = key;
    const c = fctx!;
    c.clearRect(0, 0, FS, FS);
    c.save();
    c.scale(k, k);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.fillStyle = c.strokeStyle = INK;
    const ex = s.ex;
    const ey = s.ey;
    // yeux
    if (s.eyes === "open" || s.eyes === "wide") {
      for (const cx of [466, 789]) {
        const sc = s.eyes === "wide" ? 1.16 : 1;
        const w = 112 * sc;
        const h = Math.max(236 * sc * blink, 16);
        pill(cx - w / 2 + ex, 640 + ey - h / 2, w, h);
        c.fill();
      }
    } else if (s.eyes === "half") {
      // yeux mi-clos : la paupière coupe le haut de l'œil (bord net, pente réglable)
      for (const [cx, side] of [
        [466, -1],
        [789, 1],
      ] as const) {
        const w = 112;
        const h = Math.max(236 * blink, 16);
        const x = cx - w / 2 + ex;
        const y = 640 + ey - h / 2;
        const lidY = y + h * Math.max(0, Math.min(0.92, s.lid));
        const outer = lidY + s.lidTilt;
        const inner = lidY - s.lidTilt;
        c.save();
        c.beginPath();
        if (side < 0) {
          c.moveTo(x - 40, outer);
          c.lineTo(x + w + 40, inner);
        } else {
          c.moveTo(x - 40, inner);
          c.lineTo(x + w + 40, outer);
        }
        c.lineTo(x + w + 40, y + h + 40);
        c.lineTo(x - 40, y + h + 40);
        c.closePath();
        c.clip();
        pill(x, y, w, h);
        c.fill();
        c.restore();
      }
    } else if (s.eyes === "happy") {
      c.lineWidth = 42;
      c.save();
      c.translate(ex * 0.5, ey * 0.5);
      c.stroke(HAPPY);
      c.restore();
    } else {
      c.lineWidth = 42;
      c.stroke(SQUINT);
    }
    // sourcils (même noir plein que les yeux : l'intensité joue sur l'épaisseur)
    c.lineWidth = 38;
    if (s.sly && s.eyes !== "happy" && s.eyes !== "squint") {
      c.save();
      c.translate(ex * 0.35, 0);
      c.lineWidth = 34;
      c.stroke(THINK_UP);
      c.restore();
    } else if (s.focus && s.eyes !== "happy" && s.eyes !== "squint") {
      c.save();
      c.translate(ex * 0.3, Math.max(0, ey) * 0.25);
      c.lineWidth = 32;
      c.stroke(FOCUS);
      c.restore();
    } else if (s.lift > 0.05) {
      c.save();
      c.lineWidth = 36 * Math.min(1, 0.55 + s.lift);
      c.translate(ex * 0.3, -s.lift * 22 + (s.eyes === "wide" ? -14 : 0));
      c.stroke(LIFT);
      c.restore();
    } else if (s.brows > 0.05) {
      c.lineWidth = 38 * Math.min(1, 0.45 + s.brows * 1.2);
      c.stroke(BROWS);
    }
    // bouche
    c.beginPath();
    if (s.mouth === "o") {
      c.ellipse(
        627 + s.mx,
        872,
        22 + 52 * open,
        14 + 82 * open,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    } else if (s.mouth === "whisper") {
      // bouche au coin, entrouverte, qui murmure de côté
      const cx = 627 + s.mx;
      const cy = 864;
      c.moveTo(cx - 118, cy + 6);
      c.quadraticCurveTo(cx - 10, cy - 2, cx + 96, cy - 30);
      c.quadraticCurveTo(cx + 44, cy + 44 + 70 * open, cx - 118, cy + 6);
      c.closePath();
      c.fill();
    } else if (s.mouth === "zig") {
      c.save();
      c.translate(627 + s.mx, 852);
      c.scale(0.5, 0.62);
      c.translate(-627, -852);
      c.lineWidth = 46;
      c.stroke(ZIG);
      c.restore();
    } else {
      // sourire du logo : m = 1 la bouche exacte du logo, m = 0 un trait fin qui suit la lèvre et contourne les crocs.
      // Les crocs (triangles rouges) gardent toujours la taille du logo ; seule la mâchoire du bas descend.
      const m = open;
      c.save();
      c.translate(s.mx, 0);
      c.beginPath();
      LIP.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      MOUTH_PTS.slice(TOP_N + 1).forEach(([x, y]) =>
        c.lineTo(x, lipY(x) + (y - lipY(x)) * m),
      );
      c.closePath();
      c.fill();
      c.fillStyle = RED;
      for (const f of FANGS) {
        c.beginPath();
        f.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.closePath();
        c.fill();
      }
      c.fillStyle = INK;
      const lw = 15 * (1 - Math.min(1, m * 1.8));
      if (lw > 0.5) {
        c.lineWidth = lw;
        c.beginPath();
        TOP.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
        c.stroke();
      }
      c.restore();
    }
    c.restore();
    // seul le rectangle qui peut changer est relu, puis mélangé au rouge de la sphère
    const fd = c.getImageData(fx0, fy0, RW, RH).data;
    const d = data;
    for (let j = 0; j < NLIVE; j++) {
      const p = LD[j];
      const q = LS[j];
      const a = fd[q + 3] / 255;
      const b = 1 - a;
      d[p] = 240 * b + fd[q] * a;
      d[p + 1] = 16 * b + fd[q + 1] * a;
      d[p + 2] = 28 * b + fd[q + 2] * a;
    }
    upload();
    return true;
  }

  return {
    headTex,
    alphaTex,
    draw: drawFace,
    liveTexels: NLIVE,
    resetCache() {
      faceKey = "";
    },
    reupload() {
      fullUpload = true;
      headTex.needsUpdate = true;
      alphaTex.needsUpdate = true;
      faceKey = "";
    },
    dispose() {
      headTex.dispose();
      alphaTex.dispose();
    },
  };
}
