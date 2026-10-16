/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Le petit clavier noir sur lequel il tape pendant la transcription, repris du clavier du bureau d'origine :
   socle noir, 4 rangées de 13 touches décalées + barre d'espace (côté personnage = -z), touches qui s'enfoncent
   et s'éclaircissent sous la main qui frappe, puis remontent. Mêmes dimensions, mêmes couleurs. */

import * as THREE from "three";

const KP = 0.118; // pas entre deux touches
const KY = 0.078; // hauteur du centre des touches au repos
/** Une main qui redescend sous cette hauteur (repère du clavier) frappe une touche. */
export const KEY_HIT = 0.335;

interface Key {
  x: number;
  z: number;
  w: number;
  p: number; // enfoncement 0..1
  on: boolean;
}

export interface Keyboard {
  group: THREE.Group;
  /** Frappe la touche (au hasard parmi les plus proches) sous le bout des doigts d'une main (repère du clavier). */
  pressNear(x: number, z: number, rand: () => number): void;
  /** Les touches remontent. */
  update(dt: number): void;
  /** Toutes les touches au repos. */
  reset(): void;
  dispose(): void;
}

export function createKeyboard(): Keyboard {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x17171a,
    roughness: 0.5,
    metalness: 0.2,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.06, 0.6), baseMat);
  base.position.set(0, 0.03, -0.013);
  group.add(base);

  const keys: Key[] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 13; c++)
      keys.push({
        x: (c - 6) * KP + (r % 2) * 0.03,
        z: 0.21 - r * 0.112,
        w: 1,
        p: 0,
        on: true,
      });
  keys.push({ x: 0, z: -0.236, w: 6.2, p: 0, on: true }); // espace
  const keyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
  });
  const keyMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.094, 0.036, 0.094),
    keyMat,
    keys.length,
  );
  group.add(keyMesh);
  const KEY_C = new THREE.Color(0x2b2b30);
  const KEY_HOT = new THREE.Color(0x8d8d96);
  const kd = new THREE.Object3D();
  const kc = new THREE.Color();
  const setKey = (j: number) => {
    const k = keys[j];
    kd.position.set(k.x, KY - k.p * 0.024, k.z);
    kd.scale.set(k.w, 1, 1);
    kd.updateMatrix();
    keyMesh.setMatrixAt(j, kd.matrix);
    keyMesh.setColorAt(j, kc.copy(KEY_C).lerp(KEY_HOT, k.p));
  };
  keys.forEach((_, j) => setKey(j));

  const flush = () => {
    keyMesh.instanceMatrix.needsUpdate = true;
    if (keyMesh.instanceColor) keyMesh.instanceColor.needsUpdate = true;
  };

  return {
    group,
    pressNear(x, z, rand) {
      if (Math.abs(x) > 0.9 || Math.abs(z) > 0.45) return;
      // le bout des doigts, devant la main (visible)
      const near = keys.filter(
        (k) =>
          Math.abs(k.x - x) < 0.16 * k.w && k.z > z - 0.05 && k.z < z + 0.4,
      );
      if (!near.length) return;
      const k = near[Math.floor(rand() * near.length) % near.length];
      k.p = 1;
      k.on = true;
    },
    update(dt) {
      let dirty = false;
      for (let j = 0; j < keys.length; j++) {
        const k = keys[j];
        if (k.p <= 0 && !k.on) continue;
        k.p = Math.max(0, k.p - dt * 4);
        k.on = k.p > 0;
        setKey(j);
        dirty = true;
      }
      if (dirty) flush();
    },
    reset() {
      keys.forEach((k, j) => {
        k.p = 0;
        k.on = false;
        setKey(j);
      });
      flush();
    },
    dispose() {
      base.geometry.dispose();
      baseMat.dispose();
      keyMesh.geometry.dispose();
      keyMat.dispose();
      keyMesh.dispose();
    },
  };
}
