/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Le perso au repos, dans la fenêtre principale.

   - Il respire, cligne, flotte un peu, et suit le curseur : les yeux sautent de point en point (saccades), la tête
     suit en douceur. Quand le curseur ne bouge plus, il te regarde de nouveau et bouge un peu la tête de temps en
     temps. Il peut aussi fixer une zone de la fenêtre (le panneau de réglages à droite, par exemple), en y
     promenant les yeux comme s'il lisait.
   - De temps en temps (toutes les 8 à 20 s, jamais la même deux fois de suite), une petite saynète : il regarde
     autour de lui, s'étire, bâille, fait un tour sur lui-même, tapote des doigts, salue, tend l'oreille au silence
     ou fredonne. Un clic sur lui : sursaut, fou rire, « aïe » ou pirouette ; trois clics de suite l'agacent.
   - Après une longue inactivité il s'assoupit puis s'endort ; il se réveille en sursaut quand le curseur bouge.
   - Hors dictée, chaque humeur a sa pose : chargement (il regarde la barre qui avance, tapote, soupire), micro
     absent (il tend l'oreille sans rien entendre, tapote son oreille, perplexe), erreur (gêné, après le « oups »).

   Les saynètes partent de la pose du moment et y reviennent ; une saynète interrompue (clic, curseur, humeur)
   s'efface en fondu. Tout dépend du temps et d'un aléa à graine : mêmes événements, mêmes images. */

import * as THREE from "three";
import { HEAD_Y } from "./choreography";
import type { HandWant, RestDriver, RestPose } from "./choreography";
import type { FaceState } from "./face";

export type RestMood = "pret" | "chargement" | "micro-absent" | "erreur";
export type Gaze = "souris" | "gauche" | "droite" | "bas";

/** Les saynètes (repos, humeurs, clics). */
export type ActName =
  | "regard"
  | "etire"
  | "baille"
  | "tour"
  | "tapote"
  | "salue"
  | "oreille"
  | "fredonne"
  | "sursaut"
  | "rire"
  | "aie"
  | "agace"
  | "reveil"
  | "soupir"
  | "attend"
  | "coupdoeil"
  | "toc"
  | "perplexe";

/** Il s'assoupit après ce temps sans rien (s). */
export const SLEEP_AFTER = 75;
/** Après le dernier mouvement du curseur, il le regarde encore ce temps (s), puis te regarde. */
const GAZE_HOLD = 4;
/** Fondu d'une saynète interrompue (s). */
const FADE = 0.3;

const POOLS: Record<RestMood, ActName[]> = {
  pret: [
    "regard",
    "etire",
    "baille",
    "tour",
    "tapote",
    "salue",
    "oreille",
    "fredonne",
  ],
  chargement: ["tapote", "attend", "soupir"],
  "micro-absent": ["perplexe", "toc"],
  erreur: ["coupdoeil", "soupir"],
};
/** Intervalle entre deux saynètes, selon l'humeur (s). */
const GAPS: Record<RestMood, [number, number]> = {
  pret: [8, 20],
  chargement: [3.5, 7],
  "micro-absent": [2.5, 5],
  erreur: [4, 8],
};
const POKES: ActName[] = ["sursaut", "rire", "aie", "tour"];

// ---------- petits outils ----------
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Fenêtre douce : 0 avant a, monte en r, 1 jusqu'à b - r, redescend à 0 en b. */
const env = (s: number, a: number, b: number, r = 0.25) =>
  smooth(a, a + r, s) * (1 - smooth(b - r, b, s));
/** Piste de clés [temps, valeur] (temps croissants), interpolation douce entre deux clés. */
type Keys = readonly (readonly [number, number])[];
function track(s: number, keys: Keys): number {
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (s <= t1) {
      const [t0, v0] = keys[i - 1];
      const u = (s - t0) / (t1 - t0 || 1);
      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }
  return keys[keys.length - 1][1];
}
/** Saut : hauteur d'une parabole entre a et b. */
const hop = (s: number, a: number, b: number, h: number) => {
  if (s <= a || s >= b) return 0;
  const u = (s - a) / (b - a);
  return 4 * h * u * (1 - u);
};
/** Une tape (descend puis remonte) qui commence en `at` et dure `d`. */
const tap = (s: number, at: number, d = 0.12) =>
  s > at && s < at + d ? Math.sin((Math.PI * (s - at)) / d) : 0;
/** Position d'une main, par rapport au centre de la tête au repos (repère du groupe racine). */
const hp = (x: number, y: number, z: number) =>
  new THREE.Vector3(x, HEAD_Y + y, z);
const dirOf = (x: number, y: number, z: number) =>
  new THREE.Vector3(x, y, z).normalize();
const OFF: HandWant = { on: false };
/** Écrasement à volume constant. */
const squash = (p: RestPose, sy: number) => {
  p.sy = sy;
  p.sx = 1 / Math.sqrt(sy);
};

interface Run {
  name: ActName;
  t0: number;
  /** Côté (-1 : gauche de l'écran, 1 : droite), tiré au lancement. */
  side: number;
  /** Début du fondu de sortie (-1 : pas de fondu). */
  fade: number;
}

interface Act {
  dur: number;
  /** Ne s'interrompt pas (il est en l'air) : un clic attend la fin. */
  committed?: boolean;
  run(s: number, p: RestPose, r: Run): void;
}

// ---------- les saynètes ----------
const ACTS: Record<ActName, Act> = {
  // il regarde d'un côté, puis de l'autre (les yeux d'abord, la tête suit), « tiens ? », et revient
  regard: {
    dur: 3.4,
    run(s, p, r) {
      const e = track(s, [
        [0, 0],
        [0.12, 1],
        [1.25, 1],
        [1.4, -1],
        [2.55, -1],
        [2.75, 0],
      ]);
      const h = track(s, [
        [0, 0],
        [0.3, 0],
        [0.85, 1],
        [1.45, 1],
        [2.05, -1],
        [2.6, -1],
        [3.3, 0],
      ]);
      const w = env(s, 0, 3.4, 0.35);
      p.eyeTX = r.side * 52 * e;
      p.eyeTY = -6 * Math.abs(e);
      p.yaw = mix(p.yaw, r.side * 0.5 * h, w);
      p.roll = mix(p.roll, -r.side * 0.05 * h, w);
      p.pitch = mix(p.pitch, -0.05, w);
      p.face.lift = mix(p.face.lift, 0.55, w);
      if (s > 2.0 && s < 2.5) {
        p.face.mouth = "o";
        p.face.open = 0.12;
      }
      if (s > 2.75 && s < 2.8) p.blink = true;
      p.rate = 8;
    },
  },

  // il s'étire : les deux mains montent au-dessus de la tête, yeux plissés, bouche ouverte, il tremble un peu au
  // sommet, puis relâche, content
  etire: {
    dur: 3.3,
    run(s, p) {
      const up = track(s, [
        [0, 0],
        [0.2, 0],
        [0.95, 1],
        [2.0, 1],
        [2.6, 0],
      ]);
      if (s > 0.12 && s < 2.75) {
        const tremble = up > 0.97 ? 0.012 * Math.sin(s * 55) : 0;
        const hand = (side: number): HandWant => ({
          on: true,
          pos: hp(
            side * (mix(1.27, 0.98, up) + tremble),
            mix(0.0, 1.08, up),
            mix(0.2, 0.04, up),
          ),
          dir: dirOf(side * 0.2, 1, 0.15),
          cup: 0,
          rate: 14,
        });
        p.handL = hand(-1);
        p.handR = hand(1);
      }
      squash(
        p,
        track(s, [
          [0, 1],
          [0.2, 1],
          [0.95, 1.07],
          [2.0, 1.08],
          [2.35, 0.95],
          [2.7, 1.01],
          [3.0, 1],
        ]),
      );
      p.dy = 0.07 * up;
      p.pitch = mix(p.pitch, -0.16, up);
      p.yaw *= 1 - up;
      p.roll *= 1 - up;
      if (s > 0.55 && s < 2.15) {
        p.face.eyes = "squint";
        p.face.mouth = "o";
        p.face.open = track(s, [
          [0.55, 0.1],
          [1.0, 0.5],
          [1.9, 0.55],
          [2.15, 0.2],
        ]);
      } else if (s >= 2.15 && s < 3.0) {
        p.face.eyes = "happy";
        p.face.mouth = "grin";
        p.face.open = 0.3;
      }
      p.rate = 10;
    },
  },

  // il bâille : paupières lourdes, grande bouche ronde, tête en arrière, la main tapote devant la bouche
  baille: {
    dur: 3.2,
    run(s, p) {
      if (s < 0.6) {
        p.face.eyes = "half";
        p.face.lid = track(s, [
          [0, 0],
          [0.6, 0.5],
        ]);
      } else if (s < 2.1) p.face.eyes = "squint";
      else if (s < 2.9) {
        p.face.eyes = "half";
        p.face.lid = 0.35;
      }
      if (s > 2.9 && s < 2.95) p.blink = true;
      if (s > 0.35 && s < 2.2) {
        p.face.mouth = "o";
        p.face.open = track(s, [
          [0.35, 0.08],
          [1.15, 0.95],
          [1.85, 0.95],
          [2.2, 0.04],
        ]);
      }
      p.pitch = mix(
        p.pitch,
        -0.17,
        track(s, [
          [0, 0],
          [1.15, 1],
          [1.85, 1],
          [2.3, -0.25],
          [2.8, 0],
        ]),
      );
      squash(
        p,
        track(s, [
          [0, 1],
          [1.15, 1.05],
          [1.85, 1.05],
          [2.25, 0.97],
          [2.6, 1],
        ]),
      );
      p.roll = mix(p.roll, 0.06, env(s, 0.3, 2.6, 0.4));
      p.yaw *= 1 - env(s, 0.2, 2.8, 0.4);
      if (s > 1.0 && s < 2.0)
        p.handR = {
          on: true,
          at: "mouth",
          cup: 0.6,
          off: new THREE.Vector3(
            0,
            0,
            0.07 * Math.abs(Math.sin((s - 1.0) * Math.PI * 3)),
          ),
        };
      p.rate = 8;
    },
  },

  // un petit tour sur lui-même : il se ramasse, saute, pirouette, atterrit en s'écrasant
  tour: {
    dur: 1.45,
    committed: true,
    run(s, p, r) {
      const a = 0.2;
      const b = 1.0;
      p.dy =
        hop(s, a, b, 0.24) +
        (s < a
          ? -0.045 * Math.sin((Math.PI * s) / a)
          : s > b
            ? -0.04 * Math.sin(Math.PI * clamp((s - b) / 0.25))
            : 0);
      p.dYaw = r.side * 2 * Math.PI * smooth(a, b, s);
      squash(
        p,
        s < a
          ? track(s, [
              [0, 1],
              [0.12, 0.9],
              [0.2, 1.08],
            ])
          : s < b
            ? track(s, [
                [0.2, 1.08],
                [0.45, 1],
              ])
            : track(s, [
                [1.0, 1],
                [1.08, 0.88],
                [1.25, 1.04],
                [1.45, 1],
              ]),
      );
      p.yaw *= 0.3;
      p.roll *= 0.3;
      if (s > 0.2 && s < 1.1) {
        p.face.eyes = "happy";
        p.face.mouth = "grin";
        p.face.open = 0.35;
      }
      p.rate = 14;
    },
  },

  // il tapote des doigts sur une table invisible (ta-ka-ta-ka-tam, deux fois), l'air de s'ennuyer, puis te
  // regarde : « bon… »
  tapote: {
    dur: 3.4,
    run(s, p) {
      const beats: [number, number, number][] = [
        // instant, main (0 : gauche, 1 : droite), profondeur
        [0.35, 1, 0.11],
        [0.5, 0, 0.11],
        [0.65, 1, 0.11],
        [0.8, 0, 0.11],
        [1.05, 1, 0.15],
        [1.55, 1, 0.11],
        [1.7, 0, 0.11],
        [1.85, 1, 0.11],
        [2.0, 0, 0.11],
        [2.25, 1, 0.15],
      ];
      if (s > 0.15 && s < 2.85) {
        const down = [0, 0];
        for (const [at, i, d] of beats)
          down[i] += d * tap(s, at, d > 0.12 ? 0.16 : 0.12);
        const hand = (i: number): HandWant => {
          const side = i ? 1 : -1;
          return {
            on: true,
            pos: hp(side * 1.15, -0.36 - down[i], 0.46),
            dir: dirOf(side * 0.3, -1, 0.4),
            cup: 0.15,
            rate: 40,
          };
        };
        p.handL = hand(0);
        p.handR = hand(1);
      }
      const look = env(s, 0.1, 2.55, 0.3);
      p.pitch = mix(p.pitch, 0.09, look);
      p.roll = mix(p.roll, -0.06, look);
      p.yaw = mix(p.yaw, 0.1, look);
      if (s < 2.5) {
        p.eyeTX = 30;
        p.eyeTY = 30;
        p.face.eyes = "half";
        p.face.lid = 0.38;
        p.face.lidTilt = 4;
      } else if (s < 3.25) {
        p.eyeTX = 0;
        p.eyeTY = -4;
        p.face.lift = 0.5;
        p.face.mouth = "o";
        p.face.open = 0.1;
      }
      p.rate = 8;
    },
  },

  // il salue d'une main, tout sourire
  salue: {
    dur: 2.5,
    run(s, p, r) {
      const side = r.side;
      // la main monte à côté de la tête, puis se balance (surtout vers l'extérieur, jamais au-dessus de la tête)
      const w = env(s, 0.35, 2.05, 0.2);
      const a =
        side * (0.15 + 0.55 * Math.sin(2 * Math.PI * 2.2 * (s - 0.35))) * w;
      if (s > 0.1 && s < 2.15) {
        const rise = smooth(0.1, 0.4, s);
        const pivot = hp(side * 1.22, mix(-0.5, 0.12, rise), 0.34);
        const hand: HandWant = {
          on: true,
          pos: pivot.add(
            new THREE.Vector3(0.42 * Math.sin(a), 0.42 * Math.cos(a), 0),
          ),
          dir: dirOf(Math.sin(a) * 0.6, 0.2, 1),
          cup: 0.5,
          rate: 24,
        };
        if (side < 0) p.handL = hand;
        else p.handR = hand;
      }
      const e = env(s, 0.15, 2.3, 0.25);
      p.roll = mix(p.roll, -side * 0.12, e);
      p.yaw = mix(p.yaw, 0, e);
      p.pitch = mix(p.pitch, -0.04, e);
      p.dy = 0.02 * Math.abs(Math.sin(2 * Math.PI * 2.2 * (s - 0.35))) * w;
      if (s > 0.25 && s < 2.1) {
        p.face.eyes = "happy";
        p.face.mouth = "grin";
        p.face.open = 0.55;
      }
      p.rate = 9;
    },
  },

  // il tend l'oreille (main en cornet)… rien. Il cherche des yeux, puis hausse les épaules, perplexe
  oreille: {
    dur: 3.9,
    run(s, p) {
      const L = env(s, 0, 2.55, 0.35);
      if (s > 0.12 && s < 2.5) p.handR = { on: true, cup: 1, at: "ear" };
      p.roll = mix(p.roll, -0.21, L);
      p.yaw = mix(p.yaw, -0.24, L);
      p.pitch = mix(p.pitch, -0.03, L);
      p.tx = mix(p.tx, 0.05, L);
      if (s < 1.3) {
        p.eyeTX = 54;
        p.eyeTY = -10;
        p.face.lift = 0.6;
      } else if (s < 2.5) {
        const pts: [number, number, number][] = [
          [1.3, -10, -12],
          [1.75, 48, 4],
          [2.1, 20, -16],
        ];
        let q = pts[0];
        for (const x of pts) if (s >= x[0]) q = x;
        p.eyeTX = q[1];
        p.eyeTY = q[2];
        p.face.lift = 0.8;
      } else if (s < 3.7) {
        p.eyeTX = 0;
        p.eyeTY = 0;
        p.face.brows = 0.75;
        p.face.mouth = "zig";
        p.dy =
          0.05 *
          track(s, [
            [2.55, 0],
            [2.75, 1],
            [3.05, -0.3],
            [3.3, 0],
          ]);
        p.roll += 0.07 * env(s, 2.5, 3.8, 0.3);
      }
      p.rate = 7;
    },
  },

  // il fredonne : yeux fermés, petite bouche ronde, la tête se balance en rythme
  fredonne: {
    dur: 4.2,
    run(s, p) {
      const E = env(s, 0, 4.2, 0.5);
      const beat = 2 * Math.PI * 1.3 * s;
      p.dRoll = 0.1 * Math.sin(beat / 2) * E;
      p.dy = 0.018 * Math.max(0, Math.sin(beat)) * E;
      p.dYaw = 0.05 * Math.sin(beat / 4) * E;
      p.yaw *= 1 - E;
      if (s > 0.3 && s < 3.9) {
        p.face.eyes = "happy";
        p.face.mouth = "o";
        p.face.open = 0.1 + 0.05 * Math.max(0, Math.sin(beat));
      }
      p.rate = 9;
    },
  },

  // clic : il sursaute (petit saut, yeux ronds), puis sourit
  sursaut: {
    dur: 1.0,
    committed: true,
    run(s, p) {
      p.dy = hop(s, 0.03, 0.45, 0.16);
      squash(
        p,
        track(s, [
          [0, 1],
          [0.06, 1.12],
          [0.3, 1],
          [0.45, 1],
          [0.52, 0.9],
          [0.68, 1.03],
          [0.85, 1],
        ]),
      );
      p.pitch = mix(p.pitch, -0.1, env(s, 0, 0.6, 0.1));
      if (s < 0.55) {
        p.face.eyes = "wide";
        p.face.lift = 1;
        p.face.mouth = "o";
        p.face.open = track(s, [
          [0, 0.05],
          [0.08, 0.32],
          [0.5, 0.2],
        ]);
      } else {
        p.face.mouth = "grin";
        p.face.open = 0.2;
      }
      if (s > 0.6 && s < 0.65) p.blink = true;
      p.rate = 16;
    },
  },

  // clic : fou rire, il se secoue
  rire: {
    dur: 1.4,
    run(s, p) {
      const E = env(s, 0, 1.4, 0.2);
      const k = Math.sin(2 * Math.PI * 6.5 * s);
      p.dRoll = 0.07 * k * E * (1 - s / 1.6);
      p.dy = 0.025 * Math.abs(k) * E;
      squash(p, 1 - 0.03 * Math.abs(k) * E);
      p.pitch = mix(p.pitch, -0.08, E);
      if (s > 0.05 && s < 1.3) {
        p.face.eyes = "happy";
        p.face.mouth = "grin";
        p.face.open = 0.75;
      }
      p.rate = 12;
    },
  },

  // clic : « aïe », il tremble comme une gelée
  aie: {
    dur: 1.3,
    run(s, p) {
      const w = Math.exp(-3.5 * s) * Math.cos(2 * Math.PI * 4.2 * s);
      p.sy = 1 - 0.13 * w;
      p.sx = 1 + 0.07 * w;
      p.dPitch = -0.12 * Math.exp(-4 * s);
      if (s < 0.55) {
        p.face.eyes = "squint";
        p.face.mouth = "zig";
      } else if (s < 1.2) {
        p.face.brows = 0.6;
        p.face.mouth = "o";
        p.face.open = 0.08;
      }
      if (s > 0.56 && s < 0.61) p.blink = true;
      p.rate = 12;
    },
  },

  // trop de clics : il boude, tête tournée, regard en coin
  agace: {
    dur: 2.0,
    run(s, p, r) {
      const E = env(s, 0, 2.0, 0.3);
      p.yaw = mix(p.yaw, -r.side * 0.38, E);
      p.roll = mix(p.roll, r.side * 0.06, E);
      p.pitch = mix(p.pitch, -0.03, E);
      p.dy =
        0.04 *
        track(s, [
          [0, 0],
          [0.15, 1],
          [0.35, -0.5],
          [0.5, 0],
        ]);
      if (s > 0.1 && s < 1.85) {
        p.eyeTX = r.side * 40;
        p.eyeTY = -2;
        p.face.eyes = "half";
        p.face.lid = 0.42;
        p.face.lidTilt = -9;
        p.face.mouth = "zig";
      }
      p.rate = 8;
    },
  },

  // réveil en sursaut, puis sourire gêné
  reveil: {
    dur: 1.6,
    committed: true,
    run(s, p) {
      p.dy = hop(s, 0.02, 0.4, 0.12);
      squash(
        p,
        track(s, [
          [0, 1],
          [0.08, 1.1],
          [0.35, 1],
          [0.45, 0.94],
          [0.6, 1],
        ]),
      );
      if (s < 0.6) {
        p.face.eyes = "wide";
        p.face.lift = 1;
        p.face.mouth = "o";
        p.face.open = 0.25;
      } else if (s < 1.5) {
        p.face.brows = 0.35;
        p.face.mouth = "grin";
        p.face.open = 0.15;
      }
      if ((s > 0.65 && s < 0.7) || (s > 0.95 && s < 1.0)) p.blink = true;
      p.rate = 14;
    },
  },

  // il soupire : il se gonfle, paupières lourdes, petite bouche, et se dégonfle
  soupir: {
    dur: 1.8,
    run(s, p) {
      const k = track(s, [
        [0, 0],
        [0.5, 1],
        [0.9, -0.6],
        [1.5, 0],
      ]);
      squash(p, 1 + 0.04 * k);
      p.dy = 0.03 * k;
      if (s > 0.4 && s < 1.3) {
        p.face.eyes = "half";
        p.face.lid = 0.5;
      }
      if (s > 0.6 && s < 1.2) {
        p.face.mouth = "o";
        p.face.open = 0.12;
      }
      p.rate = 7;
    },
  },

  // chargement : il lève les yeux vers toi, « c'est long… »
  attend: {
    dur: 2.2,
    run(s, p) {
      const E = env(s, 0, 2.2, 0.3);
      p.pitch = mix(p.pitch, -0.02, E);
      p.roll = mix(p.roll, 0.08, E);
      if (s > 0.15 && s < 1.95) {
        p.eyeTX = 0;
        p.eyeTY = -6;
        p.face.lift = 0.6;
      }
      if (s > 0.4 && s < 1.6) {
        p.face.mouth = "o";
        p.face.open = 0.08;
      }
      p.rate = 7;
    },
  },

  // erreur : coup d'œil gêné vers toi
  coupdoeil: {
    dur: 1.6,
    run(s, p) {
      const E = env(s, 0, 1.6, 0.25);
      p.yaw = mix(p.yaw, 0, E);
      p.roll = mix(p.roll, 0.04, E);
      p.pitch = mix(p.pitch, 0, E);
      if (s > 0.15 && s < 1.2) {
        p.eyeTX = 0;
        p.eyeTY = 0;
        p.face.brows = 0.6;
      }
      p.rate = 7;
    },
  },

  // micro absent : il tapote son oreille, « allô ? »
  toc: {
    dur: 1.6,
    run(s, p) {
      const k =
        s > 0.2 && s < 1.2
          ? Math.abs(Math.sin((Math.PI * 3 * (s - 0.2)) / 1.0))
          : 0;
      p.handR = {
        on: true,
        cup: 1,
        at: "ear",
        off: new THREE.Vector3(0.14 * k, 0, 0),
      };
      if (s > 0.1 && s < 1.4) {
        p.eyeTX = 50;
        p.eyeTY = -16;
        p.face.eyes = "half";
        p.face.lid = 0.25;
        p.face.mouth = "o";
        p.face.open = 0.08;
      }
      p.rate = 8;
    },
  },

  // micro absent : la main redescend, il secoue la tête (« rien »), hausse les épaules
  perplexe: {
    dur: 2.6,
    run(s, p) {
      if (s < 2.3) p.handR = OFF;
      const E = env(s, 0, 2.6, 0.35);
      p.roll = mix(p.roll, 0.08, E);
      p.yaw = mix(p.yaw, 0, E);
      p.pitch = mix(p.pitch, 0.02, E);
      p.tx = mix(p.tx, 0, E);
      if (s > 0.2 && s < 2.3) {
        p.eyeTX = 0;
        p.eyeTY = 2;
        p.face.brows = 0.85;
        p.face.mouth = "zig";
      }
      p.dYaw =
        0.13 * Math.sin(2 * Math.PI * 2.4 * (s - 0.5)) * env(s, 0.5, 1.5, 0.15);
      p.dy =
        0.04 *
        track(s, [
          [1.5, 0],
          [1.7, 1],
          [2.0, 0],
        ]);
      p.rate = 8;
    },
  },
};

// ---------- copie et mélange des poses ----------
function copyPose(q: RestPose, p: RestPose) {
  const f = q.face;
  Object.assign(q, p);
  q.face = Object.assign(f, p.face);
}
const NUM = [
  "tx",
  "ty",
  "roll",
  "yaw",
  "pitch",
  "rate",
  "dx",
  "dy",
  "dRoll",
  "dYaw",
  "dPitch",
  "sx",
  "sy",
  "breath",
  "eyeTX",
  "eyeTY",
  "blinkCap",
] as const;
const FACE_NUM = ["lid", "lidTilt", "brows", "lift", "open", "mx"] as const;
/** p ← p mélangé vers q (poids w) ; les choix discrets (formes du visage, mains) suivent q dès w ≥ 0,5. */
function blendPose(p: RestPose, q: RestPose, w: number) {
  if (w >= 1) {
    copyPose(p, q);
    return;
  }
  for (const k of NUM) p[k] = mix(p[k], q[k], w);
  for (const k of FACE_NUM) p.face[k] = mix(p.face[k], q.face[k], w);
  if (w >= 0.5) {
    const f = p.face;
    f.eyes = q.face.eyes;
    f.mouth = q.face.mouth;
    f.sly = q.face.sly;
    f.focus = q.face.focus;
    p.saccades = q.saccades;
    p.handL = q.handL;
    p.handR = q.handR;
  }
  p.blink = p.blink || q.blink;
  p.drop = p.drop || q.drop;
}

export class Rest implements RestDriver {
  mood: RestMood = "pret";
  gaze: Gaze = "souris";
  /** Rangé sur le côté (réglages ouverts). */
  compact = false;

  private rand: () => number;
  private t = 0;
  // curseur, en px CSS par rapport au centre de la tête (+y vers le bas) ; null : inconnu
  private cx: number | null = null;
  private cy = 0;
  private lastMove = -1e9;
  private moveAcc = 0;
  private lastActivity = 0;
  // regard (-1..1) : cible et valeur lissée
  private tgx = 0;
  private tgy = 0;
  private gx = 0;
  private gy = 0;
  // fixation des yeux (saccades) et micro-saccades
  private fixX = 0;
  private fixY = 0;
  private fixUntil = 0;
  private microX = 0;
  private microY = 0;
  private nextMicro = 0;
  // petits mouvements de tête quand rien ne se passe
  private drift = { yaw: 0, pitch: 0, roll: 0, gx: 0, gy: 0 };
  private nextDrift = 2;
  // saynètes
  private cur: Run | null = null;
  private prev: Run | null = null;
  private queued: ActName | null = null;
  private nextAct = 8;
  private lastAct: ActName | null = null;
  private lastPoke: ActName | null = null;
  private pokes: number[] = [];
  // sommeil
  private sleep: "awake" | "drowsy" | "asleep" = "awake";
  private sleepT = 0;
  private sleepK = 0;
  private nod = 0;
  private q = { face: {} as FaceState } as RestPose;

  constructor(seed = 3) {
    let s = seed >>> 0 || 1;
    this.rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  /** Pas de saynète ni d'endormissement en cours (la scène juge ensuite la vitesse de la tête). */
  get calm() {
    return !this.cur && !this.prev && this.sleep !== "drowsy";
  }

  get asleep() {
    return this.sleep === "asleep";
  }

  /** Quelque chose s'est passé (humeur, réglage, clic) : il se réveille s'il dormait. */
  activity(t: number) {
    this.lastActivity = t;
    if (this.sleep !== "awake") {
      this.sleep = "awake";
      this.start("reveil", t, true);
    }
  }

  /** Position du curseur par rapport au centre de la tête (px CSS), ou null si elle est inconnue. */
  cursor(x: number | null, y: number, t: number) {
    if (x === null) {
      this.cx = null;
      return;
    }
    if (this.cx === null) {
      this.cx = x;
      this.cy = y;
      return;
    }
    const d = Math.hypot(x - this.cx, y - this.cy);
    if (d > 2) {
      this.moveAcc += d;
      this.lastMove = t;
      this.activity(t);
    }
    this.cx = x;
    this.cy = y;
  }

  /** Clic sur lui. */
  poke(t: number) {
    this.activity(t);
    this.pokes = this.pokes.filter((x) => t - x < 2.5);
    this.pokes.push(t);
    let name: ActName;
    if (this.pokes.length >= 3) {
      name = "agace";
      this.pokes = [];
    } else {
      // jamais la même réaction deux fois de suite, ni celle qu'il est en train de jouer
      const pool = POKES.filter(
        (n) => n !== this.lastPoke && n !== this.cur?.name,
      );
      name = pool[Math.floor(this.rand() * pool.length) % pool.length];
      this.lastPoke = name;
    }
    this.start(name, t, true);
  }

  /** Joue une saynète tout de suite (salut au retour de la fenêtre, banc d'essai). */
  play(name: ActName, t: number) {
    this.activity(t);
    this.start(name, t, true);
  }

  /** Banc d'essai : il s'endort tout de suite. */
  sleepNow(t: number) {
    this.end(t);
    this.sleep = "drowsy";
    this.sleepT = 0;
    this.lastActivity = t - SLEEP_AFTER;
  }

  enter(t: number) {
    this.t = t;
    this.cur = this.prev = null;
    this.queued = null;
    this.sleep = "awake";
    this.lastActivity = t;
    this.schedule(t, this.mood === "pret" ? 0.6 : 0.3);
  }

  /** L'humeur change (hors dictée). */
  setMood(m: RestMood, t: number) {
    if (m === this.mood) return;
    this.mood = m;
    this.activity(t);
    this.end(t);
    this.schedule(t, m === "pret" ? 0.6 : 0.15);
  }

  pose(p: RestPose, t: number, dt: number) {
    this.t = t;
    this.moveAcc *= Math.exp(-dt / 0.3);
    this.updateGaze(t, dt);

    switch (this.mood) {
      case "chargement":
        this.loading(p, t);
        break;
      case "micro-absent":
        this.noMic(p, t);
        break;
      case "erreur":
        this.error(p, t);
        break;
      default:
        this.ready(p, t);
    }
    if (this.mood === "pret") this.sleepy(p, t, dt);
    this.scheduleActs(t);
    this.applyActs(p, t);
    this.sleepBreath(p, t, dt);
  }

  // ---------- regard ----------
  private updateGaze(t: number, dt: number) {
    let tx = 0;
    let ty = 0;
    if (this.gaze === "droite") tx = 0.92;
    else if (this.gaze === "gauche") tx = -0.92;
    else if (this.gaze === "bas") ty = 0.85;
    else if (this.cx !== null && t - this.lastMove < GAZE_HOLD) {
      // l'angle sous lequel il voit le curseur (comme s'il était à ~40 cm de l'écran)
      tx = clamp(Math.atan2(this.cx, 360) / 1.1, -1, 1);
      ty = clamp(Math.atan2(this.cy, 300) / 1.1, -1, 1);
    } else {
      // plus rien ne bouge : il te regarde, avec de petits mouvements de tête de temps en temps
      if (t >= this.nextDrift) {
        const big = this.rand() < 0.3;
        const r = () => this.rand() * 2 - 1;
        this.drift = {
          yaw: r() * 0.1,
          pitch: r() * 0.05,
          roll: r() * 0.07,
          gx: r() * (big ? 0.45 : 0.12),
          gy: r() * (big ? 0.25 : 0.08),
        };
        this.nextDrift = t + 2.2 + this.rand() * 3;
      }
      tx = this.drift.gx;
      ty = this.drift.gy;
    }
    this.tgx = tx;
    this.tgy = ty;
    this.gx = approach(this.gx, tx, 4.5, dt);
    this.gy = approach(this.gy, ty, 4.5, dt);
  }

  /** Les yeux sautent vers (x, y) par saccades, avec de petites micro-saccades à l'arrêt. */
  private eyes(p: RestPose, x: number, y: number, t: number, micro = 3) {
    const dx = x - this.fixX;
    const dy = y - this.fixY;
    if (
      Math.abs(dx) > 7 ||
      Math.abs(dy) > 6 ||
      (t >= this.fixUntil && (Math.abs(dx) > 1.5 || Math.abs(dy) > 1.5))
    ) {
      this.fixX = x;
      this.fixY = y;
      this.fixUntil = t + 0.18 + 0.3 * this.rand();
    }
    if (t >= this.nextMicro) {
      this.microX = (this.rand() * 2 - 1) * micro;
      this.microY = (this.rand() * 2 - 1) * micro * 0.7;
      this.nextMicro = t + 0.7 + this.rand() * 1.4;
    }
    p.eyeTX = this.fixX + this.microX;
    p.eyeTY = this.fixY + this.microY;
  }

  // ---------- poses des humeurs ----------
  private ready(p: RestPose, t: number) {
    const gx = this.gx;
    const gy = this.gy;
    const quiet = this.gaze === "souris" && t - this.lastMove >= GAZE_HOLD;
    const d = this.drift;
    const k = quiet ? 1 : 0;
    p.yaw = 0.44 * gx + d.yaw * k;
    p.pitch = 0.24 * gy - 0.03 + d.pitch * k;
    p.roll = -0.07 * gx + d.roll * k + 0.012 * Math.sin(0.53 * t);
    p.tx = 0.03 * gx;
    p.ty = 0.016 * Math.sin(1.2 * t);
    p.rate = 5;
    if (this.gaze !== "souris") {
      // il lit la zone qu'il regarde : les yeux avancent par petits sauts, puis reviennent
      const step = Math.floor(t / 0.42) % 5;
      const rx = this.gaze === "bas" ? (step - 2) * 6 : step * 4 - 6;
      const ry = this.gaze === "bas" ? 0 : (step === 4 ? 6 : 0) - 2;
      this.eyes(p, 54 * this.tgx + rx, 36 * this.tgy + ry, t, 1);
    } else this.eyes(p, 54 * this.tgx, 36 * this.tgy, t);
    p.face.lift = 0.3 * Math.max(0, -gy);
  }

  private loading(p: RestPose, t: number) {
    // il regarde la barre de chargement sous lui, les yeux suivent par petits sauts
    p.pitch = 0.17 + 0.1 * this.gy;
    p.yaw = 0.12 * this.gx;
    p.roll = 0.04 * Math.sin(0.9 * t);
    p.ty = 0.012 * Math.sin(1.2 * t);
    p.rate = 5;
    const step = Math.floor(t / 0.6) % 4;
    this.eyes(p, [-18, 0, 18, 0][step] + 10 * this.tgx, 30, t, 1);
    p.face.lift = 0.2;
    p.face.open = 0.02;
  }

  private noMic(p: RestPose, t: number) {
    // il tend l'oreille, main en cornet… et n'entend rien : les yeux cherchent
    p.handR = { on: true, cup: 1, at: "ear" };
    p.roll = -0.2 + 0.03 * Math.sin(0.8 * t);
    p.yaw = -0.22;
    p.pitch = -0.03;
    p.tx = 0.05;
    p.ty = 0.01 * Math.sin(1.1 * t);
    p.rate = 6;
    const pts: [number, number][] = [
      [54, -10],
      [30, -14],
      [60, 4],
      [40, -20],
    ];
    const q = pts[Math.floor(t / 0.9) % pts.length];
    this.eyes(p, q[0], q[1], t, 2);
    p.face.lift = 0.7;
  }

  private error(p: RestPose, t: number) {
    // gêné : il regarde en bas, sourcils inquiets, bouche crispée, un œil vers le curseur de temps en temps
    p.roll = 0.1;
    p.pitch = 0.06 + 0.08 * this.gy;
    p.yaw = -0.12 + 0.15 * this.gx;
    p.ty = -0.03 + 0.01 * Math.sin(1.1 * t);
    p.rate = 5;
    this.eyes(p, -28 + 16 * this.tgx, 22, t, 2);
    p.face.brows = 0.75;
    p.face.mouth = "zig";
  }

  // ---------- sommeil ----------
  private sleepy(p: RestPose, t: number, dt: number) {
    if (
      this.sleep === "awake" &&
      !this.cur &&
      this.gaze === "souris" &&
      t - this.lastActivity > SLEEP_AFTER
    ) {
      this.sleep = "drowsy";
      this.sleepT = 0;
    }
    if (this.sleep === "awake") return;
    this.sleepT += dt;
    const s = this.sleepT;
    if (this.sleep === "drowsy") {
      // paupières qui tombent, il pique du nez, se redresse, puis s'endort
      const lid = track(s, [
        [0, 0.15],
        [2.6, 0.62],
        [3.3, 0.7],
        [3.5, 0.1],
        [4.2, 0.45],
        [6.0, 0.88],
      ]);
      p.face.eyes = "half";
      p.face.lid = lid;
      p.eyeTX = 0;
      p.eyeTY = 10;
      p.pitch = mix(p.pitch, 0.12, smooth(0, 6, s));
      p.roll = mix(p.roll, 0.14, smooth(2, 6, s));
      this.nod =
        0.22 *
        track(s, [
          [2.6, 0],
          [3.3, 1],
          [3.45, -0.2],
          [3.8, 0],
        ]);
      if (s > 3.4 && s < 3.75) {
        p.face.eyes = "wide";
        p.face.lift = 0.8;
      }
      p.rate = 4;
      if (s >= 6) this.sleep = "asleep";
      return;
    }
    // il dort : yeux fermés, bouche entrouverte (respiration : sleepBreath)
    p.face.eyes = "open";
    p.blinkCap = 0;
    p.eyeTX = 0;
    p.eyeTY = 10;
    p.face.lift = 0;
    p.face.mouth = "o";
    p.face.open =
      0.05 + 0.05 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.2 * t + 0.6));
    p.pitch = 0.12;
    p.roll = 0.14;
    p.yaw = 0;
    p.ty = -0.04;
    p.rate = 2.5;
  }

  /** Respiration du sommeil, lente et profonde, fondue avec la respiration normale à l'endormissement comme au
      réveil (appliquée en dernier, par-dessus les saynètes : aucun saut d'échelle). */
  private sleepBreath(p: RestPose, t: number, dt: number) {
    // il pique du nez : réveillé en plein mouvement, la tête se redresse vite mais sans saut
    if (this.sleep !== "drowsy") this.nod = approach(this.nod, 0, 14, dt);
    p.dPitch += this.nod;
    const deep = this.sleep === "asleep";
    this.sleepK = approach(this.sleepK, deep ? 1 : 0, deep ? 0.7 : 5, dt);
    if (this.sleepK < 0.001) return;
    const k = this.sleepK;
    const br = Math.sin(2 * Math.PI * 0.2 * t);
    p.breath *= 1 - k;
    p.sy *= 1 + 0.022 * br * k;
    p.sx *= 1 - 0.008 * br * k;
    p.dy += 0.012 * br * k;
  }

  // ---------- saynètes ----------
  private schedule(t: number, k = 1) {
    const [a, b] = GAPS[this.mood];
    this.nextAct = t + (a + this.rand() * (b - a)) * k;
  }

  private scheduleActs(t: number) {
    if (this.cur || this.sleep !== "awake") return;
    if (this.queued) {
      const n = this.queued;
      this.queued = null;
      this.start(n, t, false);
      return;
    }
    if (t < this.nextAct) return;
    if (
      this.mood === "pret" &&
      (t - this.lastMove < 1.2 || this.moveAcc > 10)
    ) {
      // on bouge la souris : il te regarde faire, la saynète attend
      this.nextAct = t + 1.5 + this.rand() * 1.5;
      return;
    }
    const pool = POOLS[this.mood].filter((n) => n !== this.lastAct);
    const name = pool[Math.floor(this.rand() * pool.length) % pool.length];
    this.start(name, t, false);
  }

  /** Lance une saynète ; celle en cours s'efface (ou, si elle ne peut pas s'interrompre, la nouvelle attend). */
  private start(name: ActName, t: number, now: boolean) {
    const c = this.cur;
    if (c) {
      if (ACTS[c.name].committed && t - c.t0 < ACTS[c.name].dur) {
        if (now) this.queued = name;
        return;
      }
      c.fade = t;
      this.prev = c;
    }
    this.cur = { name, t0: t, side: this.rand() < 0.5 ? -1 : 1, fade: -1 };
    if (POOLS[this.mood].includes(name)) this.lastAct = name;
  }

  /** La saynète en cours s'efface (si elle peut). */
  private end(t: number) {
    const c = this.cur;
    if (!c || ACTS[c.name].committed) return;
    c.fade = t;
    this.prev = c;
    this.cur = null;
  }

  private applyActs(p: RestPose, t: number) {
    // le curseur bouge franchement pendant une saynète du repos : il s'en détourne pour le regarder
    const c = this.cur;
    if (
      c &&
      this.mood === "pret" &&
      this.moveAcc > 80 &&
      t - c.t0 > 0.3 &&
      !["sursaut", "rire", "aie", "agace", "reveil"].includes(c.name)
    )
      this.end(t);
    for (const which of ["prev", "cur"] as const) {
      const r = this[which];
      if (!r) continue;
      const act = ACTS[r.name];
      const s = t - r.t0;
      const w = r.fade >= 0 ? 1 - smooth(r.fade, r.fade + FADE, t) : 1;
      if (s >= act.dur || w <= 0) {
        this[which] = null;
        if (which === "cur") this.schedule(t);
        continue;
      }
      copyPose(this.q, p);
      act.run(s, this.q, r);
      blendPose(p, this.q, w);
    }
  }
}
