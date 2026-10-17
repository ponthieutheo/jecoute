/* Le personnage de J’écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Les volumes du personnage, repris du modèle d'origine : la boule rouge (logo projeté), l'intérieur visible par
   l'encoche entre les cornes, la paroi de l'encoche, les deux mains (sphères flottantes) et la goutte de sueur.
   Mêmes géométries, mêmes matières, même rouge. Ajout : les mains peuvent se creuser « en cornet » (cible de
   morphose), pour tendre l'oreille ou couvrir un chuchotement. */

import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createFace, type Face } from "./face";

/** Taille de la tête (rayon de la boule), comme dans le modèle d'origine. */
export const HS = 0.88;
/** Rayon d'une main, comme dans le modèle d'origine. */
export const HAND_R = 0.24;

export interface Head {
  group: THREE.Group;
  face: Face;
  materials: THREE.Material[];
  dispose(): void;
}

export function createHead(renderer?: THREE.WebGLRenderer): Head {
  const face = createFace(renderer);
  const headMat = new THREE.MeshStandardMaterial({
    map: face.headTex,
    roughness: 0.62,
    metalness: 0,
    alphaTest: 0.5,
    transparent: false,
  });
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xf0101c,
    roughness: 0.62,
    metalness: 0,
    side: THREE.BackSide,
    alphaMap: face.alphaTex,
    alphaTest: 0.5,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf0101c,
    roughness: 0.62,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  group.scale.setScalar(HS);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), headMat);
  group.add(ball);
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.985, 64, 48),
    innerMat,
  );
  group.add(inner);
  // paroi du creux des cornes : tube de l'encoche (contour extrudé en z jusqu'à la sphère)
  {
    const R = 0.301;
    const W = 0.19;
    const CY = 0.7044;
    const y1 = CY + Math.sqrt(R * R - W * W);
    const yTop = Math.sqrt(1 - W * W);
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i <= 24; i++) {
      const u = 1 - (1 - i / 24) ** 1.6;
      pts.push([-W, yTop - (yTop - y1) * u, 1, 0]);
    }
    const a0 = Math.atan2(y1 - CY, -W);
    const a1 = Math.atan2(y1 - CY, W) + Math.PI * 2;
    for (let i = 1; i < 72; i++) {
      const a = a0 + ((a1 - a0) * i) / 72;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pts.push([R * c, CY + R * s, -c, -s]);
    }
    for (let i = 0; i <= 24; i++) {
      const u = (i / 24) ** 1.6;
      pts.push([W, y1 + (yTop - y1) * u, -1, 0]);
    }
    const pos: number[] = [];
    const nor: number[] = [];
    const idx: number[] = [];
    pts.forEach(([x, y, nx, ny], i) => {
      const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
      pos.push(x, y, -z, x, y, z);
      nor.push(nx, ny, 0, nx, ny, 0);
      if (i) {
        const b = (i - 1) * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    group.add(new THREE.Mesh(g, wallMat));
  }
  return {
    group,
    face,
    materials: [headMat, innerMat, wallMat],
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      headMat.dispose();
      innerMat.dispose();
      wallMat.dispose();
      face.dispose();
    },
  };
}

/** Géométrie d'une main : la sphère d'origine, avec une cible de morphose « en cornet » (un côté creusé, ouvert
    vers +x). Les sommets sont fusionnés pour que les normales restent lisses sur la couture de la sphère. */
export function createHandGeometry(): THREE.BufferGeometry {
  const src = new THREE.SphereGeometry(HAND_R, 32, 24);
  src.deleteAttribute("uv");
  src.deleteAttribute("normal");
  const geo = mergeVertices(src);
  src.dispose();
  geo.computeVertexNormals();
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const cupPos = new Float32Array(p.count * 3);
  const C = 0.18; // bord du creux (en rayons)
  const DEPTH = 0.5; // profondeur du creux
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / HAND_R;
    const y = p.getY(i) / HAND_R;
    const z = p.getZ(i) / HAND_R;
    if (x > C) x = C - (x - C) * DEPTH;
    // la main s'aplatit un peu en se creusant (paume)
    cupPos[i * 3] = x * HAND_R * 1.02;
    cupPos[i * 3 + 1] = y * HAND_R * 1.08;
    cupPos[i * 3 + 2] = z * HAND_R * 1.08;
  }
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute("position", new THREE.BufferAttribute(cupPos, 3));
  tmp.setIndex(geo.getIndex());
  tmp.computeVertexNormals();
  geo.morphAttributes.position = [new THREE.BufferAttribute(cupPos, 3)];
  geo.morphAttributes.normal = [
    tmp.getAttribute("normal") as THREE.BufferAttribute,
  ];
  tmp.dispose();
  return geo;
}

/** La goutte de sueur d'origine (profil de révolution), pointe en haut. */
export function createDropGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI;
    pts.push(
      new THREE.Vector2(
        Math.sin(a) * Math.sin(a / 2) * 0.55,
        Math.cos(a) * 0.8,
      ),
    );
  }
  return new THREE.LatheGeometry(pts, 24);
}
