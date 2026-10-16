/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Les moments du personnage dans la fenêtre d'enregistrement :
   apparition (pop élastique) → armement (il se redresse, yeux grands ouverts) → écoute (il tend l'oreille, main en
   cornet, arcs sonores qui réagissent à la voix, hochements) → transcription (il siffle, notes) → post-traitement
   (il chuchote derrière sa main) → fin (sourire, hochement, pop inverse) ou annulation (haussement, goutte, pop
   inverse). Une relance pendant la sortie le fait revenir depuis sa taille du moment, sans saut.

   Tout est calculé à partir du temps (dt, t), sans état caché dans le rendu : la même suite d'événements donne
   toujours les mêmes images. */

import * as THREE from "three";
import type { Decor } from "./decor";
import { MAX_ARCS, MAX_NOTES } from "./decor";
import type { FaceState } from "./face";
import { HAND_R, HS } from "./head";
import type { Head } from "./head";

export type CharacterState = "recording" | "transcribing" | "processing";
export type ExitReason = "done" | "cancel";
type Phase =
  | "hidden"
  | "arming"
  | "listening"
  | "transcribing"
  | "processing"
  | "exiting";

/** Durées des sorties (s) : réaction puis pop inverse. La fenêtre native reste au moins jusque-là. */
export const EXIT_REACTION = { done: 0.42, cancel: 0.42 } as const;
export const EXIT_POP = 0.2;

/** Le pivot du pop : le bas de la tête (il surgit depuis le bas de l'écran). */
export const HEAD_Y = HS + 0.02;

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeInBack = (x: number) => 2.70158 * x * x * x - 1.70158 * x * x;

// pop élastique : 0 → 1 en 60 ms, dépasse à ~1,19 vers 120 ms, se pose avant 300 ms
const POP_A = 14;
const POP_B = (2 * Math.PI) / 0.24;
export const popCurve = (t: number) =>
  t <= 0 ? 0 : t > 0.6 ? 1 : 1 - Math.exp(-POP_A * t) * Math.cos(POP_B * t);
const popVel = (t: number) =>
  t <= 0 || t > 0.6
    ? 0
    : Math.exp(-POP_A * t) *
      (POP_A * Math.cos(POP_B * t) + POP_B * Math.sin(POP_B * t));

interface HandAnim {
  mesh: THREE.Mesh;
  on: boolean;
  ts: number; // instant du dernier changement d'état
  from: number; // échelle au moment du changement
  scale: number;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  cup: number;
}

interface Arc {
  age: number;
  life: number;
  live: boolean;
}

interface Note {
  age: number;
  life: number;
  live: boolean;
  start: THREE.Vector3;
  phase: number;
  drift: number;
}

export interface Rig {
  root: THREE.Group;
  head: Head;
  hands: [THREE.Mesh, THREE.Mesh];
  decor: Decor;
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Choreography {
  private phase: Phase = "hidden";
  private phaseT = 0; // secondes depuis le début de la phase
  private enterT = -1; // secondes depuis le début de l'apparition (-1 : pas d'apparition)
  private enterFrom = 0;
  private exitT = 0;
  private exitKind: ExitReason = "done";
  private exitFrom: Phase = "arming";
  private worked = false; // la séance est passée par la transcription
  private failed = false; // une erreur est arrivée pendant la séance
  private scale = 0; // échelle totale du moment (apparition × sortie)

  // tête (valeurs lissées)
  private hx = 0;
  private hy = 0;
  private roll = 0;
  private yaw = 0;
  private pitch = 0;
  private nod = 0;
  private nodV = 0;
  private lastNod = -10;

  // voix
  private floor = 0.5;
  private peak = 0.15;
  private env = 0;
  private level = 0;
  private prevAct = 0;

  // visage
  private nextBlink = 1.5;
  private blinkT = 0;
  private ex = 0;
  private ey = 0;
  private sacX = 0;
  private sacY = 0;
  private nextSacc = 0.8;
  private faceAt = -1;
  private faceMode = "";
  private rand: () => number;

  // signes
  private arcs: Arc[] = Array.from({ length: MAX_ARCS }, () => ({
    age: 0,
    life: 0.8,
    live: false,
  }));
  private lastArc = -10;
  private arcsK = 0;
  private notes: Note[] = Array.from({ length: MAX_NOTES }, () => ({
    age: 0,
    life: 1.7,
    live: false,
    start: new THREE.Vector3(),
    phase: 0,
    drift: 0,
  }));
  private lastNote = -10;
  private noteCount = 0;
  private notesK = 0;
  private bubbleK = 0;
  private bubbleT = -1;
  private dropT = -1;

  private hands: [HandAnim, HandAnim];

  constructor(
    private rig: Rig,
    seed = 7,
  ) {
    // aléatoire reproductible (clignements, saccades) : mêmes images pour la même suite d'événements
    let s = seed >>> 0 || 1;
    this.rand = () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
    const mk = (mesh: THREE.Mesh): HandAnim => ({
      mesh,
      on: false,
      ts: -10,
      from: 0,
      scale: 0,
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      cup: 0,
    });
    this.hands = [mk(rig.hands[0]), mk(rig.hands[1])];
    this.applyHidden();
  }

  get visible() {
    return this.phase !== "hidden";
  }

  /** L'overlay s'affiche (ou change d'état). */
  show(state: CharacterState, t: number) {
    const wasAway = this.phase === "hidden" || this.phase === "exiting";
    if (wasAway) {
      // repart de sa taille du moment (0 s'il était caché) : aucun saut
      this.enterFrom = this.phase === "hidden" ? 0 : this.scale;
      this.enterT = 0;
      if (this.phase === "hidden") this.resetPose();
    }
    if (state === "recording") {
      this.worked = false;
      this.failed = false;
      this.floor = 0.5;
      this.peak = 0.15;
      this.env = 0;
      this.setPhase("arming", t);
    } else {
      this.worked = true;
      this.setPhase(state, t);
    }
  }

  /** Le micro envoie ses premiers échantillons. */
  ready(t: number) {
    if (this.phase === "arming") this.setPhase("listening", t);
  }

  /** Niveaux du micro (16 bandes, 0..1), ~30 fois par seconde. */
  levels(l: ArrayLike<number>) {
    let sum = 0;
    const n = Math.min(12, l.length);
    for (let i = 0; i < n; i++) sum += l[i] || 0;
    this.level = n ? sum / n : 0;
  }

  /** Une erreur (transcription ou collage) : la sortie sera un « oups ». */
  error() {
    this.failed = true;
  }

  /** L'overlay se cache : réaction, puis pop inverse. */
  hide(reason: ExitReason, t: number) {
    if (this.phase === "hidden" || this.phase === "exiting") return;
    const cancel = reason === "cancel" || this.failed || !this.worked;
    this.exitKind = cancel ? "cancel" : "done";
    this.exitFrom = this.phase;
    this.setPhase("exiting", t);
    this.exitT = 0;
    if (cancel) this.dropT = 0;
  }

  /** Retire le personnage tout de suite (sans animation). */
  reset() {
    this.phase = "hidden";
    this.enterT = -1;
    this.scale = 0;
    this.resetPose();
    this.applyHidden();
  }

  /** Durée totale de la sortie en cours (s). */
  exitDuration() {
    return EXIT_REACTION[this.exitKind] + EXIT_POP;
  }

  private setPhase(p: Phase, _t: number) {
    if (p !== this.phase) {
      this.phase = p;
      this.phaseT = 0;
      if (p === "processing") this.bubbleT = -1;
    }
  }

  private resetPose() {
    this.hx = this.hy = this.roll = this.yaw = this.pitch = 0;
    this.nod = this.nodV = 0;
    this.ex = this.ey = 0;
    this.arcsK = this.notesK = this.bubbleK = 0;
    this.arcs.forEach((a) => (a.live = false));
    this.notes.forEach((n) => (n.live = false));
    this.bubbleT = -1;
    this.dropT = -1;
    this.noteCount = 0;
    for (const h of this.hands) {
      h.on = false;
      h.scale = 0;
      h.cup = 0;
    }
    this.blinkT = 0;
    this.nextBlink = 1.2 + this.rand() * 1.5;
  }

  private applyHidden() {
    this.rig.root.visible = false;
    this.rig.root.scale.setScalar(0.0001);
  }

  /** Avance l'animation. Renvoie vrai quand la sortie vient de se terminer. */
  update(dtRaw: number, t: number): boolean {
    if (this.phase === "hidden") return false;
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 20);
    this.phaseT += dt;
    if (this.enterT >= 0) this.enterT += dt;
    const { root, head, decor } = this.rig;
    root.visible = true;

    // ---------- voix : plancher de bruit adaptatif, enveloppe, attaques ----------
    const L = this.level;
    this.floor =
      L < this.floor
        ? approach(this.floor, L, 6, dt)
        : approach(this.floor, L, 0.12, dt);
    const dev = Math.max(0, L - this.floor);
    this.peak = Math.max(dev, this.peak * Math.exp(-dt / 2.5));
    const act =
      this.phase === "listening"
        ? clamp((dev - 0.025) / Math.max(0.16, this.peak))
        : 0;
    this.env = approach(this.env, act, act > this.env ? 22 : 6, dt);
    if (
      this.phase === "listening" &&
      act > 0.42 &&
      this.prevAct <= 0.42 &&
      t - this.lastNod > 0.3
    ) {
      this.nodV += 2.6 + 2.2 * act; // petit hochement à chaque attaque de syllabe
      this.lastNod = t;
    }
    this.prevAct = act;

    // ---------- échelle : apparition × sortie, écrasement/étirement ----------
    let enter = 1;
    let enterV = 0;
    if (this.enterT >= 0) {
      enter = this.enterFrom + (1 - this.enterFrom) * popCurve(this.enterT);
      enterV = ((1 - this.enterFrom) * popVel(this.enterT)) / 20;
      if (this.enterT > 0.6) this.enterT = -1;
    }
    let exitM = 1;
    let exitSx = 1;
    let exitSy = 1;
    let finished = false;
    if (this.phase === "exiting") {
      this.exitT += dt;
      const u = this.exitT - EXIT_REACTION[this.exitKind];
      if (u > 0) {
        if (u < 0.06) {
          const a = Math.sin(((u / 0.06) * Math.PI) / 2);
          exitM = 1 + 0.07 * a;
          exitSx = 1 + 0.05 * a;
          exitSy = 1 - 0.06 * a;
        } else {
          const w = clamp((u - 0.06) / (EXIT_POP - 0.06));
          exitM = Math.max(0, 1.07 * (1 - easeInBack(w)));
          exitSx = 1.05 - 0.17 * w;
          exitSy = 0.94 + 0.3 * w;
        }
        if (u >= EXIT_POP) finished = true;
      }
    }
    const v = clamp(enterV, -1, 1);
    this.scale = enter * exitM;
    const sx = Math.max(0.0001, this.scale * (1 - 0.12 * v) * exitSx);
    const sy = Math.max(0.0001, this.scale * (1 + 0.22 * v) * exitSy);
    root.scale.set(sx, sy, sx);

    // ---------- pose de la tête ----------
    const ph = this.phase === "exiting" ? this.exitFrom : this.phase;
    const pt = this.phaseT;
    let tx = 0;
    let ty = 0;
    let tRoll = 0;
    let tYaw = 0;
    let tPitch = 0;
    let rate = 9;
    const exiting = this.phase === "exiting";
    const ex = this.exitT;
    const face: FaceState = {
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
    let eyeTX = 0;
    let eyeTY = 0;
    let saccades = false;
    let handR: {
      on: boolean;
      pos?: THREE.Vector3;
      dir?: THREE.Vector3;
      cup?: number;
    } = { on: false };
    let handL: {
      on: boolean;
      pos?: THREE.Vector3;
      dir?: THREE.Vector3;
      cup?: number;
    } = { on: false };
    let wantArcs = false;
    let wantNotes = false;
    let wantBubble = false;

    if (exiting && this.exitKind === "done") {
      // fin : sourire, petit hochement satisfait
      const u = clamp(ex / 0.34);
      tPitch = 0.17 * Math.sin(Math.PI * u);
      ty = -0.02 * Math.sin(Math.PI * u);
      rate = 16;
      face.eyes = "happy";
      face.mouth = "grin";
      face.open = 0.72 * smooth(0, 0.08, ex);
    } else if (exiting) {
      // annulation : haussement d'épaules, regard en l'air, goutte de sueur
      tx = 0;
      ty = -0.08;
      tRoll = 0.12;
      tPitch = -0.06;
      rate = 14;
      face.eyes = ex < 0.12 ? "wide" : "open";
      eyeTX = -40;
      eyeTY = -36;
      face.brows = 0.9;
      face.mouth = "zig";
      const lift = 0.1 * popCurve(ex);
      handL = {
        on: true,
        pos: _v.set(-1.3, HEAD_Y - 0.18 + lift, 0.3).clone(),
        dir: new THREE.Vector3(-0.15, 1, 0.35).normalize(),
        cup: 0.75,
      };
      handR = {
        on: true,
        pos: _v.set(1.3, HEAD_Y - 0.18 + lift, 0.3).clone(),
        dir: new THREE.Vector3(0.15, 1, 0.35).normalize(),
        cup: 0.75,
      };
    } else if (ph === "arming") {
      // il se redresse, yeux grands ouverts
      tPitch = -0.1;
      ty = 0.05;
      rate = 10;
      face.eyes = "wide";
      face.lift = 1;
      eyeTY = -6;
      if (this.enterT >= 0 && this.enterT < 0.22) {
        face.mouth = "o";
        face.open = 0.3;
      }
    } else if (ph === "listening") {
      // il tend l'oreille : tête penchée vers sa main, regard de côté
      tRoll = -0.21;
      tYaw = -0.24;
      tPitch = -0.03;
      tx = 0.05;
      rate = 7;
      face.eyes = "open";
      face.lift = 0.45 + 0.3 * this.env;
      eyeTX = 54;
      eyeTY = -10;
      saccades = true;
      wantArcs = true;
      handR = { on: true, cup: 1 };
    } else if (ph === "transcribing") {
      // il siffle : yeux mi-clos, notes, léger balancement
      const beat = Math.sin(2 * Math.PI * 0.82 * pt);
      tRoll = 0.1 * beat;
      tYaw = -0.1 + 0.06 * Math.sin(Math.PI * 0.82 * pt);
      tPitch = -0.04;
      ty = 0.025 * Math.abs(beat);
      rate = 8;
      face.eyes = "half";
      face.lid = 0.42;
      eyeTX = -14;
      eyeTY = 6;
      face.mouth = "whistle";
      face.mx = -44;
      face.open = 0.3 + 0.25 * Math.abs(Math.sin(2 * Math.PI * 1.64 * pt));
      wantNotes = true;
    } else if (ph === "processing") {
      // il chuchote : main à côté de la bouche, regard complice, petite bulle pointillée
      tRoll = -0.08;
      tYaw = 0.16;
      tPitch = 0.02;
      rate = 8;
      face.eyes = "half";
      face.lid = 0.36;
      face.lidTilt = 6;
      face.sly = true;
      eyeTX = -36;
      eyeTY = -4;
      face.mouth = "whisper";
      face.mx = 70;
      const m =
        Math.abs(Math.sin(11 * pt)) * (0.55 + 0.45 * Math.sin(2.3 * pt));
      face.open = 0.2 + 0.45 * clamp(m);
      handR = { on: true, cup: 1 };
      wantBubble = true;
    }

    // hochement (ressort amorti)
    const k = 160;
    const c = 2 * Math.sqrt(k) * 0.55;
    this.nodV += (-k * this.nod - c * this.nodV) * dt;
    this.nod += this.nodV * dt;

    this.hx = approach(this.hx, tx, rate, dt);
    this.hy = approach(this.hy, ty, rate, dt);
    this.roll = approach(this.roll, tRoll, rate, dt);
    this.yaw = approach(this.yaw, tYaw, rate * 0.8, dt);
    this.pitch = approach(this.pitch, tPitch, rate, dt);
    const breath = Math.sin(t * 2.1);
    head.group.position.set(this.hx, HEAD_Y + this.hy, 0);
    head.group.rotation.set(
      this.pitch + this.nod * 0.12,
      this.yaw,
      this.roll,
      "YXZ",
    );
    head.group.scale.set(
      HS * (1 - 0.005 * breath),
      HS * (1 + 0.011 * breath),
      HS * (1 - 0.005 * breath),
    );
    head.group.updateMatrix();

    // ---------- visage ----------
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.blinkT = 0.16;
      this.nextBlink = this.rand() < 0.18 ? 0.3 : 2.4 + this.rand() * 3.2;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    const blink =
      this.blinkT > 0 ? Math.abs(this.blinkT / 0.08 - 1) * 0.92 + 0.08 : 1;
    if (saccades) {
      this.nextSacc -= dt;
      if (this.nextSacc <= 0) {
        this.nextSacc = 0.5 + this.rand() * 1.6;
        this.sacX = (this.rand() * 2 - 1) * 8;
        this.sacY = (this.rand() * 2 - 1) * 6;
      }
    } else {
      this.sacX = this.sacY = 0;
    }
    this.ex = approach(this.ex, eyeTX + this.sacX, 26, dt);
    this.ey = approach(this.ey, eyeTY + this.sacY, 26, dt);
    face.blink =
      face.eyes === "happy" || face.eyes === "squint"
        ? 1
        : Math.round(blink * 6) / 6;
    face.ex = Math.round(this.ex / 3) * 3;
    face.ey = Math.round(this.ey / 3) * 3;
    face.open = Math.round(face.open * 24) / 24;
    face.lift = Math.round(face.lift * 10) / 10;
    const mode = `${face.eyes}|${face.mouth}|${face.sly}`;
    if (mode !== this.faceMode || t - this.faceAt >= 1 / 30) {
      this.faceMode = mode;
      this.faceAt = t;
      head.face.draw(face);
    }

    // ---------- mains ----------
    const center = head.group.position;
    const headQ = head.group.quaternion;
    if (handR.on && !handR.pos) {
      if (ph === "listening") {
        // à côté de la tête, à hauteur de l'oreille, creux tourné vers le son
        handR.pos = _v
          .set(HS + HAND_R + 0.035, 0.12, -0.1)
          .applyQuaternion(headQ)
          .add(center)
          .clone();
        handR.dir = new THREE.Vector3(1, 0.25, 0.55).normalize();
      } else {
        // devant le coin de la bouche, creux tourné vers la bouche
        handR.pos = _v
          .set(0.62, -0.37, 0.8)
          .setLength(HS + HAND_R + 0.06)
          .applyQuaternion(headQ)
          .add(center)
          .clone();
        handR.dir = new THREE.Vector3(-1, 0.1, 0.55).normalize();
      }
    }
    this.stepHand(this.hands[1], handR, t, dt);
    this.stepHand(this.hands[0], handL, t, dt);

    // ---------- arcs sonores ----------
    this.arcsK = approach(this.arcsK, wantArcs ? 1 : 0, wantArcs ? 8 : 16, dt);
    const hand = this.hands[1];
    if (
      wantArcs &&
      this.env > 0.2 &&
      this.enterT < 0 &&
      t - this.lastArc > 0.44 - 0.2 * this.env
    ) {
      const a = this.arcs.find((x) => !x.live);
      if (a) {
        a.live = true;
        a.age = 0;
        a.life = 0.78;
        this.lastArc = t;
      }
    }
    const am = decor.arcs;
    let anyArc = false;
    this.arcs.forEach((a, i) => {
      if (a.live) {
        a.age += dt;
        if (a.age >= a.life) a.live = false;
      }
      if (!a.live) {
        am.alpha[i] = 0;
        return;
      }
      const u = a.age / a.life;
      am.radius[i] = 1.02 - 0.64 * u * u;
      am.width[i] = 0.075 + 0.045 * this.env;
      am.alpha[i] =
        smooth(0, 0.18, u) *
        (1 - smooth(0.66, 1, u)) *
        (0.5 + 0.5 * this.env) *
        this.arcsK;
      if (am.alpha[i] > 0.002) anyArc = true;
    });
    am.mesh.visible = anyArc && hand.scale > 0.05;
    if (am.mesh.visible) {
      am.mesh.position.copy(hand.pos);
      am.mesh.position.z += 0.02;
      am.mesh.rotation.set(0, 0, 0.2);
    }

    // ---------- notes ----------
    this.notesK = approach(
      this.notesK,
      wantNotes ? 1 : 0,
      wantNotes ? 10 : 18,
      dt,
    );
    if (wantNotes && this.phaseT > 0.25 && t - this.lastNote > 0.6) {
      const n = this.notes.find((x) => !x.live);
      if (n) {
        n.live = true;
        n.age = 0;
        n.life = 1.7;
        n.phase = this.rand() * Math.PI * 2;
        n.drift = 0.8 + this.rand() * 0.4;
        // juste à gauche de la tête, à hauteur de la bouche qui siffle (jamais sur le visage)
        n.start
          .set(-1.3, -0.16, 0.25)
          .applyQuaternion(headQ)
          .multiplyScalar(HS)
          .add(center);
        this.lastNote = t;
        this.noteCount++;
      }
    }
    this.notes.forEach((n, i) => {
      const m = decor.notes[i];
      if (n.live) {
        n.age += dt;
        if (n.age >= n.life) n.live = false;
      }
      if (!n.live || this.notesK < 0.01) {
        m.visible = false;
        return;
      }
      const u = n.age / n.life;
      m.visible = true;
      m.position.set(
        n.start.x -
          0.42 * u * n.drift -
          0.14 * u * u +
          0.08 * Math.sin(2 * Math.PI * 1.1 * n.age + n.phase),
        n.start.y + 1.5 * u,
        n.start.z + 0.15,
      );
      const s = 0.44 * popCurve(n.age * 0.9);
      m.scale.set(s, s, 1);
      m.rotation.set(
        0,
        0,
        -0.18 + 0.22 * Math.sin(2 * Math.PI * 0.9 * n.age + n.phase),
      );
      m.material.opacity =
        smooth(0, 0.08, u) * (1 - smooth(0.55, 1, u)) * this.notesK;
    });

    // ---------- bulle du chuchotement ----------
    if (wantBubble && this.bubbleT < 0 && this.phaseT > 0.16) this.bubbleT = 0;
    if (this.bubbleT >= 0) this.bubbleT += dt;
    this.bubbleK = approach(
      this.bubbleK,
      wantBubble ? 1 : 0,
      wantBubble ? 12 : 18,
      dt,
    );
    const b = decor.bubble;
    if (this.bubbleT >= 0 && this.bubbleK > 0.01 && hand.scale > 0.05) {
      b.visible = true;
      const s = popCurve(this.bubbleT) * (wantBubble ? 1 : this.bubbleK);
      b.scale.set(0.78 * s, 0.78 * s, 1);
      b.position.set(hand.pos.x + 0.62, hand.pos.y + 0.55, hand.pos.z + 0.05);
      decor.bubbleFrame.material.opacity = this.bubbleK;
      decor.bubbleDots.forEach((d, i) => {
        const p = Math.max(0, Math.sin(2 * Math.PI * (t * 1.1 - i * 0.2))) ** 2;
        d.scale.setScalar(0.8 + 0.4 * p);
        d.material.opacity = (0.35 + 0.65 * p) * this.bubbleK;
      });
    } else {
      b.visible = false;
      if (!wantBubble) this.bubbleT = -1;
    }

    // ---------- goutte de sueur (« oups ») ----------
    const dr = decor.drop;
    if (this.dropT >= 0) {
      this.dropT += dt;
      const u = clamp((this.dropT - 0.04) / 0.4);
      if (this.dropT > 0.04 && u < 1) {
        dr.visible = true;
        // sur le haut de la tempe droite, côté caméra, et qui glisse le long de la boule
        _v2
          .set(0.7, 0.52 - 0.3 * u * u, 0.5)
          .normalize()
          .multiplyScalar(1.1)
          .applyQuaternion(headQ)
          .multiplyScalar(HS)
          .add(center);
        dr.position.copy(_v2);
        dr.scale.setScalar(0.19 * popCurve(this.dropT - 0.04));
        dr.rotation.set(0, 0, -0.3);
        dr.material.opacity = 0.92 * (1 - smooth(0.75, 1, u));
      } else dr.visible = false;
    } else dr.visible = false;

    if (finished) {
      this.reset();
      return true;
    }
    return false;
  }

  private stepHand(
    h: HandAnim,
    want: {
      on: boolean;
      pos?: THREE.Vector3;
      dir?: THREE.Vector3;
      cup?: number;
    },
    t: number,
    dt: number,
  ) {
    const on = want.on && !!want.pos;
    if (on !== h.on) {
      h.on = on;
      h.ts = t;
      h.from = h.scale;
      if (on && h.scale < 0.05 && want.pos) {
        // elle apparaît à sa place (jamais de trajet à travers la tête)
        h.pos.copy(want.pos);
        if (want.dir) h.quat.setFromUnitVectors(X_AXIS, want.dir);
        h.cup = want.cup ?? 0;
      }
    }
    const age = t - h.ts;
    if (h.on) h.scale = h.from + (1 - h.from) * popCurve(age);
    else h.scale = h.from * (1 - clamp(age / 0.14) ** 2);
    if (want.pos) h.pos.lerp(want.pos, 1 - Math.exp(-18 * dt));
    if (want.dir) {
      _q.setFromUnitVectors(X_AXIS, want.dir);
      h.quat.slerp(_q, 1 - Math.exp(-14 * dt));
    }
    if (want.cup != null) h.cup = approach(h.cup, want.cup, 12, dt);

    // garde-fou : la main ne traverse jamais la tête (la boule a un rayon 1 dans son repère)
    const center = this.rig.head.group.position;
    const headR = Math.max(
      this.rig.head.group.scale.x,
      this.rig.head.group.scale.y,
    );
    const minD = headR + HAND_R * Math.max(h.scale, 0.2) + 0.04;
    _v.copy(h.pos).sub(center);
    const d = _v.length();
    if (d < minD) h.pos.copy(center).addScaledVector(_v.normalize(), minD);

    const m = h.mesh;
    m.visible = h.scale > 0.002;
    m.position.copy(h.pos);
    m.quaternion.copy(h.quat);
    m.scale.setScalar(Math.max(0.0001, h.scale));
    if (m.morphTargetInfluences) m.morphTargetInfluences[0] = h.cup;
  }
}
