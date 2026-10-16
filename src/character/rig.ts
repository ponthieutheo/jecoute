/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Le personnage monté, prêt à poser dans une scène : lumières d'origine, tête, mains, signes et clavier, plus
   ce que les deux scènes (fenêtre d'enregistrement : stage.ts, fenêtre principale : home.ts) font pareil :
   préparation des shaders et textures, perte et restauration du contexte WebGL. */

import * as THREE from "three";
import { HEAD_Y } from "./choreography";
import type { Rig } from "./choreography";
import { createDecor } from "./decor";
import type { FaceState } from "./face";
import { createHandGeometry, createHead } from "./head";
import { createKeyboard } from "./keyboard";

export interface CharacterRig extends Rig {
  /** Tout visible (préparation des shaders) ou tout caché. */
  showAll(on: boolean): void;
  dispose(): void;
}

/** Les lumières de la scène d'origine, placées pareil par rapport à la tête. */
export function addLights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xfff4ee, 0x7a5a58, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2.5, 5, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0xff2030, 18, 12);
  rim.position.set(3.45, 1.8, -3.65);
  scene.add(rim);
}

/** Le personnage : groupe racine (pivot au bas de la tête, centre de la tête à l'origine de la scène). */
export function createRig(renderer: THREE.WebGLRenderer): CharacterRig {
  const root = new THREE.Group();
  root.position.set(0, -HEAD_Y, 0);
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

  const keyboard = createKeyboard();
  keyboard.group.visible = false;
  root.add(keyboard.group);

  return {
    root,
    head,
    hands,
    decor,
    keyboard,
    showAll(on) {
      root.visible = on;
      root.scale.setScalar(on ? 1 : 0.0001);
      hands.forEach((h, i) => {
        h.visible = on;
        h.position.set(i ? 1.3 : -1.3, HEAD_Y, 0);
        if (h.morphTargetInfluences) h.morphTargetInfluences[0] = 0.5;
      });
      decor.arcs.mesh.visible = on;
      decor.arcs.alpha.fill(on ? 0.5 : 0);
      decor.bubble.visible = on;
      keyboard.group.visible = on;
      decor.drop.visible = on;
    },
    dispose() {
      head.dispose();
      handGeo.dispose();
      handMat.dispose();
      decor.dispose();
      keyboard.dispose();
    },
  };
}

/** Le visage au repos. */
export const BASE_FACE: FaceState = {
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

// une expression de chaque famille : tous les chemins de dessin du visage servent une fois
const WARM_FACES: Partial<FaceState>[] = [
  { eyes: "wide", lift: 1, mouth: "o", open: 0.3 },
  { eyes: "open", lift: 0.5, mouth: "grin", open: 0.04, ex: 54 },
  { eyes: "open", focus: true, ey: 30, mouth: "grin", open: 0.04 },
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

/** Prépare shaders, textures et visage : chaque expression est dessinée, tout le personnage est compilé puis
    rendu une fois (envoi au GPU), puis caché. Renvoie faux si la scène a été libérée entre-temps. */
export async function prepareRig(
  rig: CharacterRig,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  render: () => void,
  disposed: () => boolean,
  extraFaces: Partial<FaceState>[] = [],
): Promise<boolean> {
  for (const f of [...WARM_FACES, ...extraFaces])
    rig.head.face.draw({ ...BASE_FACE, ...f });
  rig.head.face.draw(BASE_FACE);
  rig.showAll(true);
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }
  if (disposed()) return false;
  render(); // envoie géométries et textures au GPU
  rig.showAll(false);
  return true;
}

/** Perte du contexte WebGL : le rendu s'arrête (l'animation continue) ; à la restauration, tout est renvoyé au
    GPU. `lost()` dit si le contexte est perdu. */
export function watchContextLoss(
  canvas: HTMLCanvasElement,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  rig: CharacterRig,
  onRestored?: () => void,
) {
  let lost = false;
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onBack = () => {
    lost = false;
    rig.head.face.reupload();
    rig.decor.textures.forEach((t) => (t.needsUpdate = true));
    renderer.compileAsync(scene, camera).catch(() => {});
    onRestored?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onBack);
  return {
    lost: () => lost,
    dispose() {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onBack);
    },
  };
}
