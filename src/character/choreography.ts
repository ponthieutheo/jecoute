/* Le personnage de J’écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Les moments du personnage dans la fenêtre d'enregistrement :
   apparition (pop élastique) → armement (il se redresse, yeux grands ouverts) → écoute (il tend l'oreille, main en
   cornet, arcs sonores qui réagissent à la voix, hochements de temps en temps quand on parle) → transcription (un
   petit clavier noir surgit sous lui, il tape, concentré, les touches s'enfoncent sous ses mains) →
   post-traitement (il chuchote derrière sa main) → fin (sourire, hochement, pop inverse) ou annulation (haussement,
   goutte, pop inverse). Une relance pendant la sortie le fait revenir depuis sa taille du moment, sans saut.

   La frappe dure au moins MIN_TYPING : une transcription plus rapide (elle l'est souvent) laisse la frappe se
   finir avant le chuchotement ou le sourire. Seule l'animation attend : le texte est déjà collé (le collage ne
   dépend pas de l'overlay) et la fenêtre native n'est cachée qu'après la dernière image.

   Fenêtre principale (idleMode) : le personnage reste à l'écran entre deux dictées. Au repos (phase « idle »),
   un RestDriver (rest.ts) donne la pose à chaque image ; la sortie d'une dictée joue la même réaction (sourire ou
   haussement) puis le ramène au repos, sans pop inverse. Les mêmes lissages servent partout : aucun saut entre le
   repos et la dictée.

   Tout est calculé à partir du temps (dt, t), sans état caché dans le rendu : la même suite d'événements donne
   toujours les mêmes images. */

import * as THREE from "three";
import type { Decor } from "./decor";
import { MAX_ARCS } from "./decor";
import type { FaceState } from "./face";
import { HAND_R, HS } from "./head";
import type { Head } from "./head";
import type { Keyboard } from "./keyboard";

export type CharacterState = "recording" | "transcribing" | "processing";
export type ExitReason = "done" | "cancel";
type Phase =
  | "hidden"
  | "idle"
  | "arming"
  | "listening"
  | "transcribing"
  | "processing"
  | "exiting";

/** Durées des sorties (s) : réaction puis pop inverse. La fenêtre native reste au moins jusque-là. */
export const EXIT_REACTION = { done: 0.42, cancel: 0.42 } as const;
export const EXIT_POP = 0.2;

/** Durée minimale de la frappe au clavier (s), même si la transcription est plus rapide. */
export const MIN_TYPING = 1.0;

/** Fenêtre principale : après la réaction de fin (sourire ou haussement), il la garde ce temps (s) puis revient
    au repos. */
const IDLE_RETURN = { done: 0.55, cancel: 0.7 } as const;

/** Le pivot du pop : le bas de la tête (il surgit depuis le bas de l'écran). */
export const HEAD_Y = HS + 0.02;

/* Clavier (repère du groupe racine, dont l'origine est au bas de la tête) : devant et sous la tête, incliné vers
   la caméra pour qu'on voie ses touches ; la tête monte de TYPING_LIFT pour le laisser passer dessous. Plus près
   de la caméra, il serait coupé par le bas de la fenêtre (la caméra regarde un peu vers le bas). */
const KB_POS = new THREE.Vector3(0, HEAD_Y - 0.5, 0.75);
const KB_TILT = 0.75;
const KB_SCALE = 1;
const TYPING_LIFT = 0.56;
/** Hauteur (repère du clavier, en unités de la scène) sous laquelle une main qui redescend frappe une touche. */
const HIT_Y = 0.325;
const KB_REST = new THREE.Matrix4().compose(
  KB_POS,
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), KB_TILT),
  new THREE.Vector3(1, 1, 1),
);
const KB_REST_INV = KB_REST.clone().invert();

const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const approach = (cur: number, target: number, rate: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
const easeInBack = (x: number) => 2.70158 * x * x * x - 1.70158 * x * x;
// arrivée douce avec un léger dépassement (~4 %)
const easeOutSoft = (x: number) => 1 + 1.9 * (x - 1) ** 3 + 0.9 * (x - 1) ** 2;

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

export interface HandWant {
  on: boolean;
  pos?: THREE.Vector3;
  dir?: THREE.Vector3;
  cup?: number;
  /** Vitesse de suivi (1/s) : plus haute quand il tape. */
  rate?: number;
  /** Main droite sans `pos` : à l'oreille (il écoute) ou devant le coin de la bouche (il chuchote). Par défaut :
      l'oreille pendant l'écoute, la bouche sinon. */
  at?: "ear" | "mouth";
  /** Décalage ajouté à cette place, dans le repère de la tête (petites tapes). */
  off?: THREE.Vector3;
}

/** La pose du repos, demandée à chaque image au RestDriver, qui part de valeurs neutres. */
export interface RestPose {
  /** Cibles lissées de la tête. */
  tx: number;
  ty: number;
  roll: number;
  yaw: number;
  pitch: number;
  /** Vitesse de suivi des cibles (1/s). */
  rate: number;
  /** Gestes vifs, ajoutés tels quels (sans lissage) : saut, tour sur lui-même, secousses. */
  dx: number;
  dy: number;
  dRoll: number;
  dYaw: number;
  dPitch: number;
  /** Écrasement / étirement de la tête (multiplicateurs). */
  sx: number;
  sy: number;
  /** Amplitude de la respiration (1 = normale). */
  breath: number;
  face: FaceState;
  eyeTX: number;
  eyeTY: number;
  saccades: boolean;
  /** Plafond d'ouverture des yeux : 0 = fermés (il dort). */
  blinkCap: number;
  /** Cligne maintenant. */
  blink: boolean;
  handL: HandWant;
  handR: HandWant;
  /** Lance la goutte de sueur. */
  drop: boolean;
}

export interface RestDriver {
  /** Il arrive au repos (apparition, ou fin d'une dictée). */
  enter(t: number): void;
  /** Remplit la pose du repos à l'instant t. */
  pose(p: RestPose, t: number, dt: number): void;
}

const HAND_OFF: HandWant = { on: false };

function neutralRestPose(p: RestPose, face: FaceState) {
  p.tx = p.ty = p.roll = p.yaw = p.pitch = 0;
  p.rate = 6;
  p.dx = p.dy = p.dRoll = p.dYaw = p.dPitch = 0;
  p.sx = p.sy = p.breath = 1;
  p.face = face;
  p.eyeTX = p.eyeTY = 0;
  p.saccades = false;
  p.blinkCap = 1;
  p.blink = false;
  p.handL = p.handR = HAND_OFF;
  p.drop = false;
}

interface Arc {
  age: number;
  life: number;
  live: boolean;
}

export interface Rig {
  root: THREE.Group;
  head: Head;
  hands: [THREE.Mesh, THREE.Mesh];
  decor: Decor;
  keyboard: Keyboard;
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

  // hochements « je t'entends » (voix soutenue)
  private speakT = 0;
  private quietT = 0;
  private nextNod = -1;
  private nodT = -1;
  private nodDips = 1;

  // voix
  private floor = 0;
  private floorSeeded = false; // le plancher part du premier échantillon de la séance
  private peak = 0.15;
  private env = 0;
  private level = 0;

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
  private bubbleK = 0;
  private bubbleT = -1;
  private dropT = -1;

  // clavier
  private kbOn = false;
  private kbTs = -10;
  private kbFrom = 0;
  private kbScale = 0;
  private hitY = [1, 1];

  // transitions qui attendent la fin de la frappe minimale
  private pendingProcessing = false;
  private pendingExit: ExitReason | null = null;

  private hands: [HandAnim, HandAnim];

  // fenêtre principale
  /** Le personnage reste à l'écran : une sortie le ramène au repos. */
  idleMode = false;
  rest: RestDriver | null = null;
  private restPose = {} as RestPose;

  constructor(
    private rig: Rig,
    seed = 7,
  ) {
    // aléatoire reproductible (clignements, saccades, hochements, touches) : mêmes images pour les mêmes événements
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

  /** Au repos (fenêtre principale), réaction de fin comprise. */
  get resting() {
    return this.phase === "idle" || (this.phase === "exiting" && this.idleMode);
  }

  /** En pleine dictée (fenêtre principale : hors repos). */
  get dictating() {
    return this.phase !== "hidden" && !this.resting;
  }

  /** Quelque chose s'anime à part la tête : main qui apparaît ou disparaît, clavier, goutte, apparition. */
  get busy() {
    const popping = (h: HandAnim) => h.scale > 0 && h.scale !== 1;
    return (
      popping(this.hands[0]) ||
      popping(this.hands[1]) ||
      this.kbScale > 0 ||
      this.rig.decor.drop.visible ||
      this.enterT >= 0
    );
  }

  /** Fenêtre principale : il apparaît (pop) et reste au repos. */
  appear(t: number) {
    if (this.phase !== "hidden") return;
    this.resetPose();
    this.enterFrom = 0;
    this.enterT = 0;
    this.setPhase("idle", t);
  }

  /** Fenêtre principale : « oups » (haussement d'épaules, goutte de sueur), puis retour au repos. */
  oops(t: number) {
    if (this.phase === "idle") {
      this.exitKind = "cancel";
      this.exitFrom = "idle";
      this.setPhase("exiting", t);
      this.exitT = 0;
      this.dropT = 0;
    } else if (this.phase !== "hidden" && this.phase !== "exiting") {
      this.failed = true;
      this.hide("done", t);
    }
  }

  /** L'overlay s'affiche (ou change d'état). */
  show(state: CharacterState, t: number) {
    this.pendingExit = null;
    if (
      state === "processing" &&
      this.phase === "transcribing" &&
      this.phaseT < MIN_TYPING
    ) {
      // il finit de taper avant de chuchoter
      this.pendingProcessing = true;
      return;
    }
    this.pendingProcessing = false;
    const wasAway =
      this.phase === "hidden" || (this.phase === "exiting" && !this.idleMode);
    if (wasAway) {
      // repart de sa taille du moment (0 s'il était caché) : aucun saut
      this.enterFrom = this.phase === "hidden" ? 0 : this.scale;
      this.enterT = 0;
      if (this.phase === "hidden") this.resetPose();
      else if (this.kbScale > 0) {
        // relance pendant le pop inverse d'après la frappe : clavier et mains (petits à ce moment) s'en vont tout de suite
        this.kbOn = false;
        this.kbScale = this.kbFrom = 0;
        this.rig.keyboard.group.visible = false;
        this.rig.keyboard.reset();
        for (const h of this.hands) {
          h.on = false;
          h.scale = h.from = 0;
          h.mesh.visible = false;
        }
      }
    }
    if (state === "recording") {
      this.worked = false;
      this.failed = false;
      this.floorSeeded = false;
      this.level = 0;
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
    if (!this.floorSeeded) {
      // bruit de fond de la pièce : c'est le niveau du micro avant qu'on parle
      this.floor = this.level;
      this.floorSeeded = true;
    }
  }

  /** Une erreur (transcription ou collage) : la sortie sera un « oups ». */
  error() {
    this.failed = true;
  }

  /** L'overlay se cache : réaction, puis pop inverse. */
  hide(reason: ExitReason, t: number) {
    if (
      this.phase === "hidden" ||
      this.phase === "exiting" ||
      this.phase === "idle"
    )
      return;
    const cancel = reason === "cancel" || this.failed || !this.worked;
    if (!cancel && this.phase === "transcribing" && this.phaseT < MIN_TYPING) {
      // la transcription a été plus rapide que la frappe minimale : il finit de taper, puis sourit
      this.pendingExit = reason;
      return;
    }
    this.pendingExit = null;
    this.pendingProcessing = false;
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

  private setPhase(p: Phase, t: number) {
    if (p !== this.phase) {
      this.phase = p;
      this.phaseT = 0;
      if (p === "processing") this.bubbleT = -1;
      if (p === "idle") this.rest?.enter(t);
    }
  }

  private resetPose() {
    this.hx = this.hy = this.roll = this.yaw = this.pitch = 0;
    this.speakT = this.quietT = 0;
    this.nextNod = this.nodT = -1;
    this.ex = this.ey = 0;
    this.arcsK = this.bubbleK = 0;
    this.arcs.forEach((a) => (a.live = false));
    this.bubbleT = -1;
    this.dropT = -1;
    this.kbOn = false;
    this.kbScale = this.kbFrom = 0;
    this.kbTs = -10;
    this.hitY = [1, 1];
    this.pendingProcessing = false;
    this.pendingExit = null;
    this.rig.keyboard.reset();
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
    this.rig.keyboard.group.visible = false;
  }

  /** Avance l'animation. Renvoie vrai quand la sortie vient de se terminer. */
  update(dtRaw: number, t: number): boolean {
    if (this.phase === "hidden") return false;
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 20);
    this.phaseT += dt;
    if (this.enterT >= 0) this.enterT += dt;
    if (this.phase === "transcribing" && this.phaseT >= MIN_TYPING) {
      if (this.pendingExit) {
        const reason = this.pendingExit;
        this.pendingExit = null;
        this.pendingProcessing = false;
        this.hide(reason, t);
      } else if (this.pendingProcessing) {
        this.pendingProcessing = false;
        this.setPhase("processing", t);
      }
    }
    const { root, head, decor, keyboard } = this.rig;
    root.visible = true;

    // ---------- voix : plancher de bruit adaptatif, enveloppe ----------
    const L = this.level;
    if (this.floorSeeded)
      this.floor =
        L < this.floor
          ? approach(this.floor, L, 6, dt)
          : approach(this.floor, L, 0.3, dt);
    const dev = Math.max(0, L - this.floor);
    this.peak = Math.max(dev, this.peak * Math.exp(-dt / 2.5));
    const act =
      this.phase === "listening"
        ? clamp((dev - 0.025) / Math.max(0.16, this.peak))
        : 0;
    this.env = approach(this.env, act, act > this.env ? 22 : 6, dt);

    // « je t'entends » : quand la voix dure, un hochement (une ou deux petites inclinaisons vers l'avant) toutes
    // les 1,5 à 3 s, à intervalles irréguliers ; rien pendant les silences
    if (this.env > 0.3) {
      this.speakT += dt;
      this.quietT = 0;
    } else {
      this.quietT += dt;
      if (this.quietT > 0.4) {
        this.speakT = 0;
        this.nextNod = -1;
      }
    }
    if (this.phase === "listening" && this.speakT > 0.3) {
      if (this.nextNod < 0) this.nextNod = t + 0.45 + 0.6 * this.rand();
      if (t >= this.nextNod && this.nodT < 0) {
        this.nodT = 0;
        this.nodDips = this.rand() < 0.45 ? 2 : 1;
        this.nextNod = t + 1.5 + 1.5 * this.rand();
      }
    }
    let nodPitch = 0;
    if (this.nodT >= 0) {
      this.nodT += dt;
      const DIP = 0.3;
      const k = Math.floor(this.nodT / DIP);
      if (k >= this.nodDips || this.phase !== "listening") this.nodT = -1;
      else
        nodPitch =
          (k ? 0.13 : 0.2) * Math.sin((Math.PI * (this.nodT - k * DIP)) / DIP);
    }

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
    if (this.phase === "exiting" && this.idleMode) {
      // fenêtre principale : la réaction, puis le repos (pas de pop inverse)
      this.exitT += dt;
      const k = this.exitKind;
      if (this.exitT >= EXIT_REACTION[k] + IDLE_RETURN[k])
        this.setPhase("idle", t);
    } else if (this.phase === "exiting") {
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
          exitSy = 0.94 + 0.16 * w;
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
    const exiting = this.phase === "exiting";
    const ph = exiting ? this.exitFrom : this.phase;
    const pt = this.phaseT;
    const ex = this.exitT;
    let tx = 0;
    let ty = 0;
    let tRoll = 0;
    let tYaw = 0;
    let tPitch = 0;
    let rate = 9;
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
      focus: false,
      mouth: "grin",
      open: 0.04,
      mx: 0,
    };
    let eyeTX = 0;
    let eyeTY = 0;
    let saccades = false;
    let handR: HandWant = { on: false };
    let handL: HandWant = { on: false };
    let wantArcs = false;
    let wantBubble = false;
    let rp: RestPose | null = null;
    // le clavier reste sous lui jusqu'au bout s'il tapait (fin ou annulation) ; il repart s'il chuchote ensuite
    const typing = ph === "transcribing";
    const lift = typing ? TYPING_LIFT : 0;

    if (exiting && this.exitKind === "done") {
      // fin : sourire, petit hochement satisfait (mains posées sur le clavier s'il tapait)
      const u = clamp(ex / 0.34);
      tPitch = 0.17 * Math.sin(Math.PI * u);
      ty = lift - 0.02 * Math.sin(Math.PI * u);
      rate = 16;
      face.eyes = "happy";
      face.mouth = "grin";
      face.open = 0.72 * smooth(0, 0.08, ex);
      if (typing) {
        handL = this.typingHand(0, t, false);
        handR = this.typingHand(1, t, false);
      }
    } else if (exiting) {
      // annulation : haussement d'épaules, regard en l'air, goutte de sueur
      ty = lift - 0.08;
      tRoll = 0.12;
      tPitch = -0.06;
      rate = 14;
      face.eyes = ex < 0.12 ? "wide" : "open";
      eyeTX = -40;
      eyeTY = -36;
      face.brows = 0.9;
      face.mouth = "zig";
      const hy = HEAD_Y + lift - 0.18 + 0.1 * popCurve(ex);
      handL = {
        on: true,
        pos: new THREE.Vector3(-1.3, hy, 0.3),
        dir: new THREE.Vector3(-0.15, 1, 0.35).normalize(),
        cup: 0.75,
      };
      handR = {
        on: true,
        pos: new THREE.Vector3(1.3, hy, 0.3),
        dir: new THREE.Vector3(0.15, 1, 0.35).normalize(),
        cup: 0.75,
      };
    } else if (ph === "idle") {
      // fenêtre principale, au repos : la pose vient du RestDriver
      rp = this.restPose;
      neutralRestPose(rp, face);
      this.rest?.pose(rp, t, dt);
      tx = rp.tx;
      ty = rp.ty;
      tRoll = rp.roll;
      tYaw = rp.yaw;
      tPitch = rp.pitch;
      rate = rp.rate;
      eyeTX = rp.eyeTX;
      eyeTY = rp.eyeTY;
      saccades = rp.saccades;
      handL = rp.handL;
      handR = rp.handR;
      if (rp.drop) this.dropT = 0;
      if (rp.blink && this.blinkT <= 0) this.blinkT = 0.16;
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
      // il tape : tête montée au-dessus du clavier, yeux baissés vers les touches, sourcils froncés
      tRoll = 0.035 * Math.sin(2 * Math.PI * 1.4 * pt);
      tPitch = 0.13;
      ty = lift + 0.012 * Math.abs(Math.sin(9 * pt));
      rate = 11;
      face.eyes = "open";
      face.focus = true;
      eyeTY = 30;
      eyeTX = 6 * Math.sin(2 * Math.PI * 0.7 * pt);
      handL = this.typingHand(0, t, true);
      handR = this.typingHand(1, t, true);
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
    // hors frappe, la tête ne redescend qu'au rythme du clavier qui repart (jamais à travers lui)
    if (!typing) ty += TYPING_LIFT * this.kbScale;

    this.hx = approach(this.hx, tx, rate, dt);
    this.hy = approach(this.hy, ty, rate, dt);
    this.roll = approach(this.roll, tRoll, rate, dt);
    this.yaw = approach(this.yaw, tYaw, rate * 0.8, dt);
    this.pitch = approach(this.pitch, tPitch, rate, dt);
    const breath = Math.sin(t * 2.1);
    if (rp) {
      // repos : gestes vifs et écrasement par-dessus la pose lissée
      const b = breath * rp.breath;
      head.group.position.set(this.hx + rp.dx, HEAD_Y + this.hy + rp.dy, 0);
      head.group.rotation.set(
        this.pitch + nodPitch + rp.dPitch,
        this.yaw + rp.dYaw,
        this.roll + rp.dRoll,
        "YXZ",
      );
      head.group.scale.set(
        HS * (1 - 0.005 * b) * rp.sx,
        HS * (1 + 0.011 * b) * rp.sy,
        HS * (1 - 0.005 * b) * rp.sx,
      );
    } else {
      head.group.position.set(this.hx, HEAD_Y + this.hy, 0);
      head.group.rotation.set(
        this.pitch + nodPitch,
        this.yaw,
        this.roll,
        "YXZ",
      );
      head.group.scale.set(
        HS * (1 - 0.005 * breath),
        HS * (1 + 0.011 * breath),
        HS * (1 - 0.005 * breath),
      );
    }
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
    if (rp) face.blink = Math.min(face.blink, rp.blinkCap);
    face.ex = Math.round(this.ex / 3) * 3;
    face.ey = Math.round(this.ey / 3) * 3;
    face.open = Math.round(face.open * 24) / 24;
    face.lift = Math.round(face.lift * 10) / 10;
    const mode = `${face.eyes}|${face.mouth}|${face.sly}|${face.focus}`;
    if (mode !== this.faceMode || t - this.faceAt >= 1 / 30) {
      this.faceMode = mode;
      this.faceAt = t;
      head.face.draw(face);
    }

    // ---------- clavier et mains ----------
    const center = head.group.position;
    const headQ = head.group.quaternion;
    if (handR.on && !handR.pos) {
      if ((handR.at ?? (ph === "listening" ? "ear" : "mouth")) === "ear") {
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
          .set(0.64, -0.27, 0.8)
          .setLength(HS + HAND_R + 0.06)
          .applyQuaternion(headQ)
          .add(center)
          .clone();
        handR.dir = new THREE.Vector3(-1, 0.1, 0.55).normalize();
      }
      if (handR.off) handR.pos.add(_v.copy(handR.off).applyQuaternion(headQ));
    }
    this.stepKeyboard(typing, t);
    this.stepHand(this.hands[1], handR, t, dt);
    this.stepHand(this.hands[0], handL, t, dt);
    // une main qui redescend sur le clavier enfonce la touche sous le bout de ses doigts
    if (typing && this.kbScale > 0.6) {
      this.hands.forEach((h, i) => {
        _v.copy(h.pos).applyMatrix4(KB_REST_INV);
        if (h.scale > 0.6 && this.hitY[i] >= HIT_Y && _v.y < HIT_Y)
          keyboard.pressNear(_v.x / KB_SCALE, _v.z / KB_SCALE, this.rand);
        this.hitY[i] = _v.y;
      });
    }
    if (keyboard.group.visible) keyboard.update(dt);

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
      am.radius[i] = 0.92 - 0.56 * u * u;
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

  /** Main qui tape (ou posée sur le clavier), dans le repère du groupe racine. Les deux mains alternent. */
  private typingHand(i: number, t: number, typingNow: boolean): HandWant {
    const side = i ? 1 : -1;
    const bounce = typingNow
      ? Math.max(0, Math.sin(17 * t + i * Math.PI)) * 0.1
      : 0;
    _v.set(
      side * 0.52 + Math.sin(1.3 * t + i * 2) * 0.06,
      0.3 + bounce,
      -0.06,
    ).applyMatrix4(KB_REST);
    return {
      on: true,
      pos: _v.clone(),
      dir: new THREE.Vector3(side * 0.2, -1, 0.3).normalize(),
      cup: 0,
      rate: 40,
    };
  }

  /** Le clavier surgit (entrée douce) au début de la frappe et repart s'il passe au chuchotement. */
  private stepKeyboard(want: boolean, t: number) {
    const kb = this.rig.keyboard;
    if (want !== this.kbOn) {
      this.kbOn = want;
      this.kbTs = t;
      this.kbFrom = this.kbScale;
    }
    const age = t - this.kbTs;
    if (this.kbOn)
      this.kbScale =
        this.kbFrom +
        (1 - this.kbFrom) * easeOutSoft(clamp((age - 0.06) / 0.3));
    else this.kbScale = this.kbFrom * (1 - clamp(age / 0.16) ** 2);
    const g = kb.group;
    const was = g.visible;
    g.visible = this.kbScale > 0.002;
    if (!g.visible) {
      if (was) kb.reset();
      return;
    }
    g.position.copy(KB_POS);
    g.position.y -= 0.12 * (1 - Math.min(1, this.kbScale));
    g.rotation.set(KB_TILT, 0, 0);
    g.scale.setScalar(Math.max(0.0001, KB_SCALE * this.kbScale));
  }

  private stepHand(h: HandAnim, want: HandWant, t: number, dt: number) {
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
    if (want.pos) h.pos.lerp(want.pos, 1 - Math.exp(-(want.rate ?? 18) * dt));
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
