/* Le personnage de J'écoute. Copyright (c) 2026 Théo Ponthieu.
   Licence : PolyForm Noncommercial 1.0.0 (voir LICENSE dans ce dossier) — usage non commercial uniquement.
   Le reste de l'application est sous licence MIT. */

/* Les petits signes graphiques autour du personnage, sans aucun texte :
   - les arcs sonores qui arrivent dans sa main quand il tend l'oreille (un seul quadrilatère, arcs calculés dans
     le shader : épaisseur constante quel que soit le rayon, bouts arrondis, bord lissé) ;
   - les notes de musique quand il siffle ;
   - la petite bulle pointillée (trois points) quand il chuchote ;
   - la goutte de sueur du modèle d'origine (« oups »).
   Tout est en aplat rouge #f0101c (non éclairé), sauf la goutte qui garde sa matière d'origine. */

import * as THREE from "three";
import { createDropGeometry } from "./head";

export const MAX_ARCS = 4;
export const MAX_NOTES = 6;

const RED = 0xf0101c;
const RED_CSS = "#f0101c";

export interface Decor {
  group: THREE.Group;
  arcs: {
    mesh: THREE.Mesh;
    radius: Float32Array;
    alpha: Float32Array;
    width: Float32Array;
  };
  notes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  bubble: THREE.Group;
  bubbleFrame: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  bubbleDots: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[];
  drop: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  textures: THREE.Texture[];
  dispose(): void;
}

function canvasTexture(
  w: number,
  h: number,
  paint: (c: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  if (!c) throw new Error("toile 2D indisponible");
  paint(c);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// croche (♪) : tête ovale penchée, hampe, crochet
function paintNote(c: CanvasRenderingContext2D) {
  c.fillStyle = RED_CSS;
  c.beginPath();
  c.ellipse(46, 96, 23, 16.5, -0.42, 0, Math.PI * 2);
  c.fill();
  c.fillRect(60, 18, 9.5, 80);
  c.beginPath();
  c.moveTo(60, 16);
  c.bezierCurveTo(66, 40, 106, 44, 98, 84);
  c.bezierCurveTo(94, 62, 84, 52, 66, 50);
  c.closePath();
  c.fill();
}

// deux croches liées (♫)
function paintNotes(c: CanvasRenderingContext2D) {
  c.fillStyle = RED_CSS;
  for (const [x, y] of [
    [32, 102],
    [92, 90],
  ]) {
    c.beginPath();
    c.ellipse(x, y, 19, 14, -0.42, 0, Math.PI * 2);
    c.fill();
  }
  c.fillRect(42, 28, 8.5, 74);
  c.fillRect(102, 16, 8.5, 74);
  c.beginPath();
  c.moveTo(42, 22);
  c.lineTo(110.5, 10);
  c.lineTo(110.5, 28);
  c.lineTo(42, 40);
  c.closePath();
  c.fill();
}

// bulle pointillée, queue en bas à gauche (vers la bouche)
function paintBubble(c: CanvasRenderingContext2D) {
  c.strokeStyle = RED_CSS;
  c.lineWidth = 11;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.setLineDash([2, 21]);
  c.beginPath();
  c.moveTo(70, 150);
  c.lineTo(28, 182);
  c.lineTo(52, 134);
  c.stroke();
  c.beginPath();
  c.roundRect(22, 18, 212, 128, 64);
  c.stroke();
}

const ARC_VERT = /* glsl */ `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const ARC_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uR[${MAX_ARCS}];
uniform float uA[${MAX_ARCS}];
uniform float uW[${MAX_ARCS}];
uniform float uSpan;
varying vec2 vPos;
float arcDist(vec2 p, float r) {
  float a = atan(p.y, p.x);
  if (abs(a) <= uSpan) return abs(length(p) - r);
  vec2 e = r * vec2(cos(uSpan), sign(a) * sin(uSpan));
  return length(p - e);
}
void main() {
  float alpha = 0.0;
  for (int i = 0; i < ${MAX_ARCS}; i++) {
    float d = arcDist(vPos, uR[i]);
    float aa = fwidth(d) * 0.8;
    float hw = uW[i] * 0.5;
    alpha = max(alpha, (1.0 - smoothstep(hw - aa, hw + aa, d)) * uA[i]);
  }
  if (alpha <= 0.002) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}`;

export function createDecor(): Decor {
  const group = new THREE.Group();
  const textures: THREE.Texture[] = [];

  // arcs sonores
  const radius = new Float32Array(MAX_ARCS);
  const alpha = new Float32Array(MAX_ARCS);
  const width = new Float32Array(MAX_ARCS).fill(0.08);
  const arcMat = new THREE.ShaderMaterial({
    vertexShader: ARC_VERT,
    fragmentShader: ARC_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(RED) },
      uR: { value: radius },
      uA: { value: alpha },
      uW: { value: width },
      uSpan: { value: 0.78 },
    },
  });
  const arcMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), arcMat);
  arcMesh.renderOrder = 3;
  arcMesh.visible = false;
  group.add(arcMesh);

  // notes
  const noteTex = canvasTexture(128, 128, paintNote);
  const notesTex = canvasTexture(128, 128, paintNotes);
  textures.push(noteTex, notesTex);
  const noteGeo = new THREE.PlaneGeometry(1, 1);
  const notes = Array.from({ length: MAX_NOTES }, (_, i) => {
    const m = new THREE.Mesh(
      noteGeo,
      new THREE.MeshBasicMaterial({
        map: i % 3 === 1 ? notesTex : noteTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        opacity: 0,
      }),
    );
    m.renderOrder = 4;
    m.visible = false;
    group.add(m);
    return m;
  });

  // bulle du chuchotement
  const bubble = new THREE.Group();
  bubble.visible = false;
  const bubbleTex = canvasTexture(256, 192, paintBubble);
  textures.push(bubbleTex);
  const bubbleFrame = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 0.75),
    new THREE.MeshBasicMaterial({
      map: bubbleTex,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  bubbleFrame.renderOrder = 4;
  bubble.add(bubbleFrame);
  const dotGeo = new THREE.CircleGeometry(0.052, 20);
  const bubbleDots = [-1, 0, 1].map((i) => {
    const d = new THREE.Mesh(
      dotGeo,
      new THREE.MeshBasicMaterial({
        color: RED,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    d.position.set(i * 0.2, 0.09, 0.001);
    d.renderOrder = 5;
    bubble.add(d);
    return d;
  });
  group.add(bubble);

  // goutte de sueur (matière d'origine)
  const drop = new THREE.Mesh(
    createDropGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x8ccfff,
      roughness: 0.03,
      metalness: 0.1,
      transparent: true,
      opacity: 0,
      emissive: 0x2f8fd0,
      emissiveIntensity: 0.55,
    }),
  );
  drop.visible = false;
  drop.renderOrder = 2;
  group.add(drop);

  return {
    group,
    arcs: { mesh: arcMesh, radius, alpha, width },
    notes,
    bubble,
    bubbleFrame,
    bubbleDots,
    drop,
    textures,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      textures.forEach((t) => t.dispose());
    },
  };
}
