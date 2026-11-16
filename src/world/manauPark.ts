/**
 * Kachin National Manau Park, Myitkyina — modeled from reference photos:
 * - Manau shadung: 6 vertical poles on a long yellow base beam, the middle two tallest,
 *   diagonal arms forming a "K K K" silhouette, one triangle-patterned crossbar,
 *   spiral / zigzag-triangle paintings, banded tops (some with a V notch), red base
 *   blocks with crossed swords, and emblems along the beam (hornbill head at the left end,
 *   target, crescent, sun, star, drum, white feather tail at the right end).
 * - A raised platform on a huge grey paved dance ground ringed by flags, with bunting
 *   strung from the poles and a steel lattice light tower beside them.
 * - Entrance arch: two white tusks curving up to a yellow "KACHIN NATIONAL MANAU PARK"
 *   sign with a sun emblem, red / green pillars with crossed swords and crescent,
 *   decorated side panels and two bronze statues.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { brickTexture, concreteDetailTexture, planarUV } from './textures';

const RED = '#c8102e';
const YELLOW = '#f2c12e';
const GREEN = '#1f7a3a';
const BLUE = '#1f4fa0';
const WHITE = '#f8f5ec';
const BLACK = '#1a1a1a';

function canvasTex(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D) => void,
  renderer?: THREE.WebGLRenderer,
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (renderer) t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function drawSpiral(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = r * 0.1;
  g.lineCap = 'round';
  g.beginPath();
  const turns = 2.6;
  for (let a = 0; a <= turns * Math.PI * 2; a += 0.12) {
    const rr = (a / (turns * Math.PI * 2)) * r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (a === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
}

/** Tall pole panel: 128×512, one tile = pole width × 4 widths */
function poleTexture(kind: 'spiral_red' | 'spiral_blue' | 'triangles', renderer: THREE.WebGLRenderer) {
  return canvasTex(
    128,
    512,
    (g) => {
      if (kind === 'triangles') {
        // Zigzag of colored triangles, as on the multicolor poles
        g.fillStyle = YELLOW;
        g.fillRect(0, 0, 128, 512);
        const cols = [RED, BLUE, YELLOW, GREEN];
        for (let row = 0; row < 8; row++) {
          const y = row * 64;
          g.fillStyle = cols[row % 4];
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(128, y + 32);
          g.lineTo(0, y + 64);
          g.fill();
          g.fillStyle = cols[(row + 2) % 4];
          g.beginPath();
          g.moveTo(128, y + 32);
          g.lineTo(128, y + 96);
          g.lineTo(0, y + 64);
          g.fill();
        }
      } else {
        const bg = kind === 'spiral_red' ? RED : WHITE;
        const fg = kind === 'spiral_red' ? WHITE : BLUE;
        g.fillStyle = bg;
        g.fillRect(0, 0, 128, 512);
        for (let k = 0; k < 4; k++) drawSpiral(g, 64, 64 + k * 128, 46, fg);
      }
      // Yellow edge trim
      g.fillStyle = YELLOW;
      g.fillRect(0, 0, 8, 512);
      g.fillRect(120, 0, 8, 512);
    },
    renderer,
  );
}

/** Crossbar: alternating green / white / yellow triangles */
function crossbarTexture(renderer: THREE.WebGLRenderer) {
  return canvasTex(
    256,
    64,
    (g) => {
      g.fillStyle = WHITE;
      g.fillRect(0, 0, 256, 64);
      for (let k = 0; k < 4; k++) {
        const x = k * 64;
        g.fillStyle = GREEN;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 64, 0);
        g.lineTo(x + 32, 64);
        g.fill();
        g.fillStyle = YELLOW;
        g.beginPath();
        g.moveTo(x + 32, 64);
        g.lineTo(x + 64, 0);
        g.lineTo(x + 96, 64);
        g.fill();
      }
      g.fillStyle = BLACK;
      g.fillRect(0, 0, 256, 4);
      g.fillRect(0, 60, 256, 4);
    },
    renderer,
  );
}

/** Square emblem plate used on the base beam and block faces */
function emblemTexture(
  kind: 'swords' | 'target' | 'crescent' | 'sun' | 'star' | 'drum' | 'bird',
  renderer: THREE.WebGLRenderer,
) {
  return canvasTex(
    128,
    128,
    (g) => {
      const bg = { swords: RED, target: BLUE, crescent: GREEN, sun: WHITE, star: BLUE, drum: YELLOW, bird: RED }[kind];
      g.fillStyle = bg;
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = YELLOW;
      g.lineWidth = 8;
      g.strokeRect(4, 4, 120, 120);
      g.fillStyle = WHITE;
      g.strokeStyle = WHITE;
      if (kind === 'swords') {
        g.lineWidth = 14;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(30, 30);
        g.lineTo(98, 98);
        g.moveTo(98, 30);
        g.lineTo(30, 98);
        g.stroke();
      } else if (kind === 'target') {
        for (const [r, col] of [
          [44, WHITE],
          [32, BLACK],
          [20, WHITE],
          [9, BLACK],
        ] as [number, string][]) {
          g.fillStyle = col;
          g.beginPath();
          g.arc(64, 64, r, 0, Math.PI * 2);
          g.fill();
        }
      } else if (kind === 'crescent') {
        g.beginPath();
        g.arc(60, 64, 36, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = GREEN;
        g.beginPath();
        g.arc(76, 58, 32, 0, Math.PI * 2);
        g.fill();
      } else if (kind === 'sun') {
        g.fillStyle = RED;
        g.beginPath();
        g.arc(64, 64, 38, 0, Math.PI * 2);
        g.fill();
      } else if (kind === 'star') {
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 === 0 ? 44 : 18;
          const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
          const x = 64 + Math.cos(a) * r;
          const y = 66 + Math.sin(a) * r;
          if (k === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
        g.fill();
      } else if (kind === 'drum') {
        g.fillStyle = BLACK;
        g.beginPath();
        g.ellipse(64, 64, 42, 30, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#7c4a1e';
        g.beginPath();
        g.ellipse(64, 64, 30, 20, 0, 0, Math.PI * 2);
        g.fill();
      } else {
        // bird
        g.fillStyle = BLACK;
        g.beginPath();
        g.ellipse(58, 70, 30, 18, -0.3, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(86, 48, 12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = YELLOW;
        g.beginPath();
        g.moveTo(96, 44);
        g.lineTo(118, 54);
        g.lineTo(96, 54);
        g.fill();
      }
    },
    renderer,
  );
}

function signTexture() {
  return canvasTex(1024, 128, (g) => {
    g.fillStyle = '#e8b923';
    g.fillRect(0, 0, 1024, 128);
    g.strokeStyle = BLACK;
    g.lineWidth = 8;
    g.strokeRect(6, 6, 1012, 116);
    g.fillStyle = BLACK;
    g.font = 'bold 64px "Outfit", "Arial Black", sans-serif';
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillText('KACHIN', 230, 66);
    g.fillText('MANAU', 790, 66);
    g.font = 'bold 34px "Outfit", "Arial Black", sans-serif';
    g.fillText('NATIONAL', 512, 40);
    g.fillText('PARK', 512, 96);
  });
}

function sunEmblemTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#e8b923';
    g.beginPath();
    g.arc(128, 128, 126, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1f2a24';
    g.beginPath();
    g.arc(128, 128, 104, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e8b923';
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a - 0.1) * 30, 128 + Math.sin(a - 0.1) * 30);
      g.lineTo(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92);
      g.lineTo(128 + Math.cos(a + 0.1) * 30, 128 + Math.sin(a + 0.1) * 30);
      g.fill();
    }
    g.beginPath();
    g.arc(128, 128, 28, 0, Math.PI * 2);
    g.fill();
  });
}

/** Painted concrete is matte: cut the room-environment reflection that washes colors out. */
function matte(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    const list = Array.isArray(m) ? m : m ? [m] : [];
    for (const mat of list) {
      if (mat instanceof THREE.MeshStandardMaterial && mat.metalness < 0.5) {
        mat.envMapIntensity = 0.25;
        mat.roughness = Math.max(mat.roughness, 0.75);
      }
    }
  });
}

/** Box whose front/back faces (±z) carry a texture and sides a plain color. */
function paintedBox(
  w: number,
  h: number,
  d: number,
  face: THREE.Texture,
  side: string,
  repeatY: number,
): THREE.Mesh {
  const tex = face.clone();
  tex.needsUpdate = true;
  tex.repeat.set(1, repeatY);
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
  const sideMat = new THREE.MeshStandardMaterial({ color: side, roughness: 0.6 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, sideMat, sideMat, faceMat, faceMat]);
  m.castShadow = true;
  return m;
}

function emblemPlate(tex: THREE.Texture, size: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
}

// ---------------------------------------------------------------------------
// Manau poles (shadung) on their platform
// ---------------------------------------------------------------------------
export function buildShadung(renderer: THREE.WebGLRenderer): THREE.Group {
  const root = new THREE.Group();
  const texSpiralRed = poleTexture('spiral_red', renderer);
  const texSpiralBlue = poleTexture('spiral_blue', renderer);
  const texTri = poleTexture('triangles', renderer);
  const yellowMat = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.6 });

  // Raised platform with a red front skirt
  const platH = 1.2;
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(30, platH, 9),
    [yellowMat, yellowMat, new THREE.MeshStandardMaterial({ color: '#d9d4c7' }), yellowMat, new THREE.MeshStandardMaterial({ color: RED }), new THREE.MeshStandardMaterial({ color: RED })],
  );
  platform.position.y = platH / 2;
  platform.castShadow = true;
  platform.receiveShadow = true;
  root.add(platform);

  // Long yellow base beam with emblems
  const beamY = platH;
  const beamH = 1.4;
  const beamL = 24;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(beamL, beamH, 1.4), yellowMat);
  beam.position.set(0, beamY + beamH / 2, 0);
  beam.castShadow = true;
  root.add(beam);
  const beamEmblems = ['bird', 'target', 'crescent', 'sun', 'star', 'drum'] as const;
  beamEmblems.forEach((k, i) => {
    const tex = emblemTexture(k, renderer);
    for (const side of [1, -1]) {
      const p = emblemPlate(tex, 1.1);
      p.position.set(-9 + i * 3.6, beamY + beamH / 2, side * 0.72);
      if (side < 0) p.rotation.y = Math.PI;
      root.add(p);
    }
  });
  // Hornbill head at the left end: dark head, big yellow bill with red casque
  const headMat = new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.5 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), headMat);
  head.position.set(-beamL / 2 - 0.4, beamY + beamH * 0.7, 0);
  root.add(head);
  const bill = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 3.2, 12),
    new THREE.MeshStandardMaterial({ color: '#e8a317', roughness: 0.4 }),
  );
  bill.rotation.z = Math.PI / 2 + 0.35;
  bill.position.set(-beamL / 2 - 2.0, beamY + beamH * 0.35, 0);
  root.add(bill);
  const casque = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 10), new THREE.MeshStandardMaterial({ color: RED }));
  casque.rotation.z = Math.PI / 2 - 0.25;
  casque.position.set(-beamL / 2 - 1.4, beamY + beamH * 0.95, 0);
  root.add(casque);
  // White feather tail at the right end
  const tailMat = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.7, side: THREE.DoubleSide });
  for (let k = 0; k < 5; k++) {
    const feather = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.32), tailMat);
    feather.position.set(beamL / 2 + 1.2, beamY + beamH * 0.5 + (k - 2) * 0.22, 0);
    feather.rotation.z = (k - 2) * 0.12;
    root.add(feather);
  }

  // Six poles: middle two tallest
  const topY = beamY + beamH;
  const xs = [-9, -5.4, -1.8, 1.8, 5.4, 9];
  const heights = [12.5, 13.5, 16.5, 17.5, 13.5, 12.5];
  const faces = [texSpiralRed, texTri, texSpiralRed, texTri, texSpiralBlue, texTri];
  const poleW = 1.15;
  const poleD = 0.55;
  const bandCols = [RED, YELLOW, GREEN, BLUE, WHITE];
  xs.forEach((x, i) => {
    const h = heights[i];
    // Red base block with crossed swords
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.6, 1.7), new THREE.MeshStandardMaterial({ color: RED }));
    block.position.set(x, topY + 0.8, 0);
    block.castShadow = true;
    root.add(block);
    const swords = emblemTexture(i % 2 === 0 ? 'swords' : 'bird', renderer);
    for (const side of [1, -1]) {
      const p = emblemPlate(swords, 1.3);
      p.position.set(x, topY + 0.8, side * 0.86);
      if (side < 0) p.rotation.y = Math.PI;
      root.add(p);
    }
    // Painted shaft
    const shaftBottom = topY + 1.6;
    const shaft = paintedBox(poleW, h, poleD, faces[i], YELLOW, h / (poleW * 4));
    shaft.position.set(x, shaftBottom + h / 2, 0);
    root.add(shaft);
    // Colored bands at the top
    for (let b = 0; b < 4; b++) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(poleW + 0.08, 0.38, poleD + 0.08),
        new THREE.MeshStandardMaterial({ color: bandCols[(b + i) % bandCols.length] }),
      );
      band.position.set(x, shaftBottom + h + 0.19 + b * 0.38, 0);
      root.add(band);
    }
    // Some tops end in a V notch (two "ears")
    const capY = shaftBottom + h + 4 * 0.38;
    if (i % 2 === 1) {
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.3, poleD), new THREE.MeshStandardMaterial({ color: RED }));
        ear.position.set(x + s * 0.34, capY + 0.55, 0);
        ear.rotation.z = -s * 0.32;
        root.add(ear);
      }
    } else {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(poleW / 2, poleW / 2, poleD, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: RED }));
      cap.rotation.x = Math.PI / 2;
      cap.rotation.y = Math.PI / 2;
      cap.position.set(x, capY, 0);
      root.add(cap);
    }
  });

  // Diagonal arms forming the "K K K" silhouette: left half lean left, right half lean right
  const arms: [number, number, number, number, THREE.Texture][] = [
    // [x at bottom, y at bottom, length, angle from vertical (+ = lean left), texture]
    [-5.4, topY + 3.0, 9.5, 0.62, texTri],
    [-1.8, topY + 3.0, 11, 0.6, texSpiralBlue],
    [1.8, topY + 3.0, 11, -0.6, texSpiralRed],
    [5.4, topY + 3.0, 9.5, -0.62, texTri],
    [-9, topY + 8.5, 4.5, 0.75, texTri],
    [9, topY + 8.5, 4.5, -0.75, texTri],
  ];
  for (const [bx, by, len, ang, tex] of arms) {
    const arm = paintedBox(0.95, len, 0.45, tex, YELLOW, len / 3.8);
    arm.position.set(bx - Math.sin(ang) * (len / 2), by + Math.cos(ang) * (len / 2), 0.15);
    arm.rotation.z = ang;
    root.add(arm);
    // banded tip
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.5), new THREE.MeshStandardMaterial({ color: BLUE }));
    tip.position.set(bx - Math.sin(ang) * len, by + Math.cos(ang) * len, 0.15);
    tip.rotation.z = ang;
    root.add(tip);
  }

  // Horizontal crossbar at about a third of the height
  const cbTex = crossbarTexture(renderer);
  cbTex.repeat.set(10, 1);
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(beamL + 1, 0.85, 0.75),
    new THREE.MeshStandardMaterial({ map: cbTex, roughness: 0.55 }),
  );
  crossbar.position.set(0, topY + 6.2, 0.3);
  crossbar.castShadow = true;
  root.add(crossbar);

  matte(root);
  return root;
}

// ---------------------------------------------------------------------------
// Dance ground details: flags around the circle, bunting, light tower
// ---------------------------------------------------------------------------
export function buildManauGroundDressing(
  radius: number,
  poleTopY: number,
  poles: { x: number; z: number },
  towerAt: { x: number; z: number },
): THREE.Group {
  const root = new THREE.Group();
  const flagCols = ['#c8102e', '#1f7a3a', '#6d28d9', '#f472b6', '#1f4fa0', '#f2c12e', '#f97316', '#0ea5e9'];
  const mastMat = new THREE.MeshStandardMaterial({ color: '#d4d4d8', metalness: 0.6, roughness: 0.35 });

  // Flag masts around the dance ground
  const nFlags = 36;
  const flagTops: THREE.Vector3[] = [];
  for (let i = 0; i < nFlags; i++) {
    const a = (i / nFlags) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 6, 6), mastMat);
    mast.position.set(x, 3, z);
    root.add(mast);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 0.8),
      new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], side: THREE.DoubleSide }),
    );
    flag.position.set(x + Math.cos(a + Math.PI / 2) * 0.62, 5.5, z + Math.sin(a + Math.PI / 2) * 0.62);
    flag.rotation.y = -a;
    root.add(flag);
    flagTops.push(new THREE.Vector3(x, 6, z));
  }

  // Bunting: strings of small triangle pennants from the pole tops out to every third mast
  const tri: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const from = new THREE.Vector3(poles.x, poleTopY, poles.z);
  flagTops.forEach((to, i) => {
    if (i % 3 !== 0) return;
    const n = 26;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = from.clone().lerp(to, t);
      p.y -= Math.sin(Math.PI * t) * 2.5; // sag
      const dir = to.clone().sub(from).setY(0).normalize();
      const s = 0.32;
      tri.push(p.x - dir.x * s, p.y, p.z - dir.z * s, p.x + dir.x * s, p.y, p.z + dir.z * s, p.x, p.y - 0.55, p.z);
      c.set(flagCols[(k + i) % flagCols.length]);
      for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b);
    }
  });
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  bg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  bg.computeVertexNormals();
  root.add(new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 })));

  // Steel lattice light tower to the side of the poles
  const tower = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#9ca3af', metalness: 0.7, roughness: 0.35 });
  const H = 22;
  const parts: THREE.BufferGeometry[] = [];
  const leg = (sx: number, sz: number) => {
    const g = new THREE.CylinderGeometry(0.08, 0.12, H, 6);
    const top = new THREE.Vector3(sx * 0.5, H, sz * 0.5);
    const bottom = new THREE.Vector3(sx * 1.6, 0, sz * 1.6);
    const mid = top.clone().add(bottom).multiplyScalar(0.5);
    const dir = top.clone().sub(bottom).normalize();
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
    g.translate(mid.x, mid.y, mid.z);
    parts.push(g);
  };
  leg(1, 1);
  leg(-1, 1);
  leg(1, -1);
  leg(-1, -1);
  for (let y = 2; y < H; y += 2.5) {
    const half = 1.6 - (y / H) * 1.1;
    for (const [w, d] of [
      [half * 2, 0.06],
      [0.06, half * 2],
    ]) {
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(w, 0.06, d);
        g.translate(w > d ? 0 : s * half, y, w > d ? s * half : 0);
        parts.push(g);
      }
    }
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  parts.forEach((p) => p.dispose());
  if (merged) tower.add(new THREE.Mesh(merged, steel));
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.0, 0.5),
    new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#fef9c3', emissiveIntensity: 0.6 }),
  );
  lamp.position.y = H + 0.5;
  tower.add(lamp);
  tower.position.set(towerAt.x, 0, towerAt.z);
  root.add(tower);

  return root;
}

// ---------------------------------------------------------------------------
// Entrance gate: tusk arch, sign, pillars, side panels, statues
// ---------------------------------------------------------------------------
export function buildManauGate(renderer: THREE.WebGLRenderer): THREE.Group {
  const gate = new THREE.Group();
  const ivory = new THREE.MeshStandardMaterial({ color: '#f1efe7', roughness: 0.45 });
  const span = 5.5; // half distance between tusk bases

  // Pillars: red upper block with crossed swords, green lower block with crescent
  const swords = emblemTexture('swords', renderer);
  const crescent = emblemTexture('crescent', renderer);
  for (const s of [-1, 1]) {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(2, 1.6, 2), new THREE.MeshStandardMaterial({ color: GREEN }));
    lower.position.set(s * span, 0.8, 0);
    gate.add(lower);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), new THREE.MeshStandardMaterial({ color: RED }));
    upper.position.set(s * span, 2.3, 0);
    gate.add(upper);
    for (const f of [1, -1]) {
      const a = emblemPlate(crescent, 1.3);
      a.position.set(s * span, 0.8, f * 1.01);
      if (f < 0) a.rotation.y = Math.PI;
      gate.add(a);
      const b = emblemPlate(swords, 1.2);
      b.position.set(s * span, 2.3, f * 1.01);
      if (f < 0) b.rotation.y = Math.PI;
      gate.add(b);
    }
    // Tusk: tapered segments along a curve rising and bending inward
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(s * span, 3.0, 0),
      new THREE.Vector3(s * (span + 0.6), 9.5, 0),
      new THREE.Vector3(s * 1.4, 10.8, 0),
    );
    const segs = 14;
    for (let k = 0; k < segs; k++) {
      const a = curve.getPoint(k / segs);
      const b = curve.getPoint((k + 1) / segs);
      const r0 = 0.75 * (1 - k / segs) + 0.12;
      const r1 = 0.75 * (1 - (k + 1) / segs) + 0.12;
      const len = a.distanceTo(b);
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len * 1.05, 14), ivory);
      seg.position.copy(a.clone().add(b).multiplyScalar(0.5));
      seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      seg.castShadow = true;
      gate.add(seg);
    }
    // Dark ring near the tusk base
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.12, 8, 20), new THREE.MeshStandardMaterial({ color: '#3f3f46' }));
    ringM.rotation.x = Math.PI / 2;
    ringM.position.set(s * span, 3.6, 0);
    gate.add(ringM);

    // Decorated side panel (pole-style board) beyond each pillar
    const panel = paintedBox(1.6, 6.5, 0.4, poleTexture(s < 0 ? 'triangles' : 'spiral_red', renderer), YELLOW, 1.2);
    panel.position.set(s * (span + 3.0), 3.25, 0.2);
    gate.add(panel);
    const panel2 = paintedBox(1.3, 5.5, 0.4, poleTexture('spiral_blue', renderer), YELLOW, 1.0);
    panel2.position.set(s * (span + 4.6), 2.75, 0.2);
    gate.add(panel2);

    // Bronze statue on a pedestal (man with shield on one side, woman on the other)
    const bronze = new THREE.MeshStandardMaterial({ color: '#6b5a45', metalness: 0.65, roughness: 0.45 });
    const ped = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: '#57534e' }));
    ped.position.set(s * (span + 7.2), 0.5, 1.4);
    gate.add(ped);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 2.0, 10), bronze);
    body.position.set(s * (span + 7.2), 2.0, 1.4);
    gate.add(body);
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), bronze);
    headM.position.set(s * (span + 7.2), 3.25, 1.4);
    gate.add(headM);
    if (s < 0) {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), bronze);
      shield.rotation.z = Math.PI / 2;
      shield.position.set(s * (span + 7.2) - 0.45, 2.1, 1.4);
      gate.add(shield);
    }
  }

  // Yellow sign across the top with a sun emblem above it
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 1.15, 0.3),
    [
      new THREE.MeshStandardMaterial({ color: '#e8b923' }),
      new THREE.MeshStandardMaterial({ color: '#e8b923' }),
      new THREE.MeshStandardMaterial({ color: '#e8b923' }),
      new THREE.MeshStandardMaterial({ color: '#e8b923' }),
      new THREE.MeshStandardMaterial({ map: signTexture() }),
      new THREE.MeshStandardMaterial({ map: signTexture() }),
    ],
  );
  sign.position.set(0, 9.2, 0);
  sign.castShadow = true;
  gate.add(sign);
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 40),
    new THREE.MeshStandardMaterial({ map: sunEmblemTexture(), side: THREE.DoubleSide }),
  );
  sun.position.set(0, 10.6, 0.05);
  gate.add(sun);

  matte(gate);
  return gate;
}

// ---------------------------------------------------------------------------
// Park grounds from Google satellite + visitor photos (meters from the circle center,
// +x east, +z south): paved circle r≈36 m, ring road to r≈46 m, eight paths out to an
// outer loop, rain trees along paths and in the dry-grass fields, bronze statue NW.
// ---------------------------------------------------------------------------
// Measured on 19z satellite: paved dance circle r ≈ 44 m, narrow ring road to ≈ 48 m
export const MANAU_PAVED_RADIUS = 43.5;
export const MANAU_RING_OUTER = 48;

/** Ends of the eight radial paths, measured on the satellite image */
const SPOKE_ENDS: [number, number][] = [
  [-4, -100], // N (to the north building compound)
  [73, -73], // NE
  [133, -40], // E
  [105, 89], // SE
  [-4, 117], // S
  [-80, 103], // SW
  [-190, -32], // W — main entrance (gate) where it meets Munkhrain Rd side
  [-77, -117], // NW
];
/** Angles (atan2(z, x)) of the radial paths, for openings in the railing */
export const MANAU_SPOKE_ANGLES = SPOKE_ENDS.map(([x, z]) => Math.atan2(z, x));
// Outer loop path; on the west it runs outside the long hall (x ≈ -178..-99, z ≈ 22..70)
const OUTER_LOOP: [number, number][] = [
  [-77, -117],
  [-4, -104],
  [73, -73],
  [133, -40],
  [142, 25],
  [105, 89],
  [-4, 117],
  [-80, 103],
  [-190, 88],
  [-190, -32],
  [-160, -92],
  [-77, -117],
];

/** Main entrance: west end of the west path (where the player stood in the user's screenshot) */
export const MANAU_GATE = { x: -192, z: -32, facing: Math.atan2(-1, 0) };

/** Brick perimeter wall: the outer loop pushed ~5 m outward */
export const MANAU_WALL_LOOP: [number, number][] = OUTER_LOOP.map(([x, z]) => {
  const d = Math.hypot(x, z) || 1;
  return [x + (x / d) * 5, z + (z / d) * 5];
});
/** Long maroon-roofed hall to the WSW comes from the building data; keep trees off it */
const KEEP_CLEAR: { x: number; z: number; r: number }[] = [
  { x: -138, z: 54, r: 48 },
  { x: -4, z: -93, r: 26 },
];

function flatStrip(ax: number, az: number, bx: number, bz: number, width: number, y: number): THREE.BufferGeometry {
  const len = Math.hypot(bx - ax, bz - az);
  const g = new THREE.BoxGeometry(width, 0.06, len);
  g.rotateY(Math.atan2(bx - ax, bz - az));
  g.translate((ax + bx) / 2, y, (az + bz) / 2);
  return g.toNonIndexed();
}

/** Broad, flat-topped canopy like the park's rain trees (shared with town trees) */
export function createRainTreeGeometries(): { trunk: THREE.BufferGeometry; canopy: THREE.BufferGeometry } {
  const trunk = new THREE.CylinderGeometry(0.28, 0.45, 4.2, 7);
  trunk.translate(0, 2.1, 0);
  const blobs: THREE.BufferGeometry[] = [];
  const parts: [number, number, number, number][] = [
    [0, 5.4, 0, 3.4],
    [2.3, 5.0, 0.8, 2.5],
    [-2.2, 5.1, -0.6, 2.6],
    [0.6, 5.2, -2.2, 2.4],
    [-0.8, 4.9, 2.1, 2.4],
  ];
  for (const [x, y, z, r] of parts) {
    const b = new THREE.IcosahedronGeometry(r, 1);
    b.scale(1, 0.62, 1);
    b.translate(x, y, z);
    blobs.push(b.toNonIndexed());
  }
  const canopy = mergeGeometries(blobs, false)!;
  blobs.forEach((b) => b.dispose());
  canopy.computeVertexNormals();
  return { trunk, canopy };
}

export function buildManauParkGrounds(groundY: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group();

  // Ring road around the dance circle (lighter concrete)
  const concrete = concreteDetailTexture();
  const ringGeo = new THREE.RingGeometry(MANAU_PAVED_RADIUS, MANAU_RING_OUTER, 96);
  ringGeo.rotateX(-Math.PI / 2);
  planarUV(ringGeo, 2.5);
  const ring = new THREE.Mesh(
    ringGeo,
    new THREE.MeshStandardMaterial({ color: '#b3b2aa', map: concrete, roughness: 0.95, envMapIntensity: 0.3 }),
  );
  ring.position.y = groundY(0, 0) + 0.18;
  ring.receiveShadow = true;
  root.add(ring);

  // Eight paths and the outer loop (concrete walkways, 6 m / 5 m wide)
  const pathGeos: THREE.BufferGeometry[] = [];
  for (const [ex, ez] of SPOKE_ENDS) {
    const d = Math.hypot(ex, ez);
    const sx = (ex / d) * MANAU_RING_OUTER;
    const sz = (ez / d) * MANAU_RING_OUTER;
    pathGeos.push(flatStrip(sx, sz, ex, ez, 6, groundY(ex, ez) + 0.16));
  }
  for (let i = 0; i < OUTER_LOOP.length - 1; i++) {
    const [ax, az] = OUTER_LOOP[i];
    const [bx, bz] = OUTER_LOOP[i + 1];
    pathGeos.push(flatStrip(ax, az, bx, bz, 5, groundY(ax, az) + 0.15));
  }
  const paths = mergeGeometries(pathGeos, false);
  pathGeos.forEach((g) => g.dispose());
  if (paths) {
    planarUV(paths, 2.0);
    const m = new THREE.Mesh(
      paths,
      new THREE.MeshStandardMaterial({ color: '#aaa99f', map: concrete, roughness: 0.95, envMapIntensity: 0.3 }),
    );
    m.receiveShadow = true;
    root.add(m);
  }

  // Rain trees: rows along both sides of each path, a ring outside the ring road, field clusters
  const spots: { x: number; z: number; s: number }[] = [];
  let seed = 9091;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const clear = (x: number, z: number) =>
    !KEEP_CLEAR.some((k) => Math.hypot(x - k.x, z - k.z) < k.r) && Math.hypot(x, z) > MANAU_RING_OUTER + 5;
  for (const [ex, ez] of SPOKE_ENDS) {
    const d = Math.hypot(ex, ez);
    const ux = ex / d;
    const uz = ez / d;
    for (let t = MANAU_RING_OUTER + 12; t < d - 6; t += 13) {
      for (const side of [-1, 1]) {
        const x = ux * t - uz * 8 * side;
        const z = uz * t + ux * 8 * side;
        if (clear(x, z)) spots.push({ x, z, s: 0.9 + rand() * 0.5 });
      }
    }
  }
  // Ring of trees between the paths, just outside the ring road
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    const x = Math.cos(a) * (MANAU_RING_OUTER + 8);
    const z = Math.sin(a) * (MANAU_RING_OUTER + 8);
    const nearSpoke = SPOKE_ENDS.some(([ex, ez]) => {
      const sa = Math.atan2(ez, ex);
      let dA = Math.abs(sa - a) % (Math.PI * 2);
      if (dA > Math.PI) dA = Math.PI * 2 - dA;
      return dA < 0.16;
    });
    if (!nearSpoke && clear(x, z)) spots.push({ x, z, s: 0.8 + rand() * 0.4 });
  }
  // Big shade trees scattered in the fields between the paths
  for (let k = 0; k < 60; k++) {
    const a = rand() * Math.PI * 2;
    const r = 62 + rand() * 80;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (clear(x, z) && spots.every((p) => Math.hypot(p.x - x, p.z - z) > 11)) {
      spots.push({ x, z, s: 1.2 + rand() * 0.8 });
    }
  }

  const { trunk, canopy } = createRainTreeGeometries();
  const trunkInst = new THREE.InstancedMesh(
    trunk,
    new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.9 }),
    spots.length,
  );
  const canopyInst = new THREE.InstancedMesh(
    canopy,
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }),
    spots.length,
  );
  trunkInst.castShadow = true;
  canopyInst.castShadow = true;
  canopyInst.receiveShadow = true;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const greens = ['#3f6b2a', '#4a7a30', '#355e26', '#56823a'];
  spots.forEach((p, i) => {
    dummy.position.set(p.x, groundY(p.x, p.z), p.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(p.s, p.s * (0.85 + rand() * 0.25), p.s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    canopyInst.setMatrixAt(i, dummy.matrix);
    canopyInst.setColorAt(i, col.set(greens[i % greens.length]));
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  root.add(trunkInst, canopyInst);

  // Tall bronze statue (crossed arms) on a pedestal, NW of the circle among trees
  const statue = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: '#7a6a52', metalness: 0.7, roughness: 0.4 });
  const ped = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 3.2), new THREE.MeshStandardMaterial({ color: '#8a8580' }));
  ped.position.y = 1.2;
  statue.add(ped);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(1.3, 3.4, 0.8), bronze);
  legs.position.y = 4.1;
  statue.add(legs);
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.85, 3.6, 10), bronze);
  coat.position.y = 7.4;
  statue.add(coat);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.7), bronze);
  arms.position.set(0, 8.2, 0.55);
  statue.add(arms);
  const headM = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), bronze);
  headM.position.y = 9.8;
  statue.add(headM);
  statue.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  statue.position.set(-48, groundY(-48, -43), -43);
  statue.rotation.y = Math.atan2(48, 43); // faces the circle
  root.add(statue);

  return root;
}

// ---------------------------------------------------------------------------
// Details from the 360° photo inside the circle (Google Maps photo sphere):
// metal railing around the dance circle, floodlight masts, the open viewing pavilion
// (columns, green roof band, white central gable) and the two-storey red-roof building.
// ---------------------------------------------------------------------------
export function buildCircleRailing(radius: number, gapAngles: number[], y: number): THREE.Group {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const n = Math.round((Math.PI * 2 * radius) / 2.4);
  const inGap = (a: number) =>
    gapAngles.some((g) => {
      let d = Math.abs(g - a) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d < 3.5 / radius; // ~7 m opening per path
    });
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    if (inGap(a0) || inGap(a1)) continue;
    const x0 = Math.cos(a0) * radius, z0 = Math.sin(a0) * radius;
    const x1 = Math.cos(a1) * radius, z1 = Math.sin(a1) * radius;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    for (const [hy, th] of [
      [1.0, 0.06],
      [0.15, 0.05],
    ] as [number, number][]) {
      const rail = new THREE.BoxGeometry(0.06, th, len);
      rail.rotateY(ang);
      rail.translate((x0 + x1) / 2, y + hy, (z0 + z1) / 2);
      geos.push(rail.toNonIndexed());
    }
    // lattice: one diagonal per bay
    const diag = new THREE.BoxGeometry(0.04, 0.04, Math.hypot(len, 0.85));
    diag.rotateX(Math.atan2(0.85, len));
    diag.rotateY(ang);
    diag.translate((x0 + x1) / 2, y + 0.58, (z0 + z1) / 2);
    geos.push(diag.toNonIndexed());
    const post = new THREE.BoxGeometry(0.08, 1.05, 0.08);
    post.translate(x0, y + 0.52, z0);
    geos.push(post.toNonIndexed());
  }
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  if (merged) {
    root.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ color: '#c9ccc8', metalness: 0.5, roughness: 0.45 })));
  }
  return root;
}

export function buildFloodlightMast(height: number): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#d1d5db', metalness: 0.6, roughness: 0.35 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, height, 10), steel);
  pole.position.y = height / 2;
  pole.castShadow = true;
  g.add(pole);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 6, 20), steel);
  ringM.rotation.x = Math.PI / 2;
  ringM.position.y = height;
  g.add(ringM);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: '#f1f5f9', emissive: '#fef9c3', emissiveIntensity: 0.4 }),
    );
    lamp.position.set(Math.cos(a) * 0.9, height + 0.1, Math.sin(a) * 0.9);
    g.add(lamp);
  }
  return g;
}

/** Open viewing pavilion north of the circle: columns, green roof band, white central gable. */
export function buildViewingPavilion(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#efeee8', roughness: 0.8, envMapIntensity: 0.3 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), new THREE.MeshStandardMaterial({ color: '#b7b4ab', roughness: 0.9 }));
  floor.position.y = 0.3;
  g.add(floor);
  // Back wall (north), open toward the circle
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, 0.3), white);
  back.position.set(0, 2.7, -d / 2 + 0.2);
  g.add(back);
  // Columns along the front and sides
  const colMat = new THREE.MeshStandardMaterial({ color: '#f5f3ee', roughness: 0.7 });
  for (let i = 0; i <= 8; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 4.2, 10), colMat);
    c.position.set(-w / 2 + 0.4 + (i * (w - 0.8)) / 8, 2.7, d / 2 - 0.4);
    c.castShadow = true;
    g.add(c);
  }
  // Roof slab with green fascia band and red trim
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 0.5, d + 1.2), new THREE.MeshStandardMaterial({ color: '#7f8a84', roughness: 0.8 }));
  roof.position.y = 5.05;
  roof.castShadow = true;
  g.add(roof);
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 1.3, 0.9, d + 1.3), new THREE.MeshStandardMaterial({ color: '#2f8f4e', roughness: 0.6 }));
  band.position.y = 5.6;
  g.add(band);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.35, 0.18, d + 1.35), new THREE.MeshStandardMaterial({ color: '#b91c1c' }));
  trim.position.y = 5.1;
  g.add(trim);
  // Low hip roof above the band
  // Satellite: red-brown roof from above; green fascia band visible from the side (360° photo)
  const hip = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2, 2.6, 4), new THREE.MeshStandardMaterial({ color: '#8f3b2c', roughness: 0.65, envMapIntensity: 0.3 }));
  hip.rotation.y = Math.PI / 4;
  hip.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45);
  hip.position.y = 7.15;
  g.add(hip);
  // White triangular gable over the middle, facing the circle (+z)
  const tri = new THREE.Shape();
  tri.moveTo(-3.2, 0);
  tri.lineTo(3.2, 0);
  tri.lineTo(0, 3.0);
  tri.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.4, bevelEnabled: false }), white);
  gable.position.set(0, 6.05, d / 2 + 0.3);
  g.add(gable);
  g.traverse((o) => ((o as THREE.Mesh).receiveShadow = true));
  return g;
}

/** Two-storey white colonial-style building with a red hip roof and two rows of windows. */
export function buildRedRoofHouse(w: number, d: number): THREE.Group {
  const g = new THREE.Group();
  const wallTex = canvasTex(256, 128, (c) => {
    c.fillStyle = '#f4f2ec';
    c.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 6; k++) {
        const x = 12 + k * 41;
        const y = 14 + row * 62;
        c.fillStyle = '#e2ded3';
        c.fillRect(x - 3, y - 3, 30, 40);
        c.fillStyle = '#4b5d66';
        c.fillRect(x, y, 24, 34);
        c.fillStyle = '#e2ded3';
        c.fillRect(x + 11, y, 2, 34);
        c.fillRect(x, y + 16, 24, 2);
      }
    }
    c.fillStyle = '#2f8f4e';
    c.fillRect(0, 118, 256, 10);
  });
  wallTex.repeat.set(Math.max(1, Math.round(w / 14)), 1);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 7, d), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, envMapIntensity: 0.3 }));
  walls.position.y = 3.5;
  walls.castShadow = true;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.8, 3.4, 4), new THREE.MeshStandardMaterial({ color: '#a32020', roughness: 0.6, envMapIntensity: 0.3 }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45);
  roof.position.y = 8.7;
  roof.castShadow = true;
  g.add(roof);
  return g;
}

/**
 * Red brick perimeter wall with cream coping and pillars every ~12 m, along a closed loop,
 * leaving openings at the gates and wherever a street or path crosses it. UVs run in meters along the wall so bricks keep size.
 */
export function buildBrickWall(
  loop: [number, number][],
  groundY: (x: number, z: number) => number,
  openings: { x: number; z: number; half: number }[],
): THREE.Group {
  const root = new THREE.Group();
  const H = 1.9;
  const T = 0.3;
  const wallPos: number[] = [];
  const wallUv: number[] = [];
  const capGeos: THREE.BufferGeometry[] = [];
  let run = 0;
  const quad = (a: number[], b: number[], c: number[], d: number[], ua: number[], ub: number[], uc: number[], ud: number[]) => {
    wallPos.push(...a, ...b, ...c, ...a, ...c, ...d);
    wallUv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
  };
  for (let i = 0; i < loop.length - 1; i++) {
    const [ax, az] = loop[i];
    const [bx, bz] = loop[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(len / 3));
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps;
      const t1 = (k + 1) / steps;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const segLen = Math.hypot(x1 - x0, z1 - z0);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (openings.some((o) => Math.hypot(mx - o.x, mz - o.z) < o.half)) {
        run += segLen;
        continue;
      }
      const nx = -(z1 - z0) / segLen * (T / 2);
      const nz = (x1 - x0) / segLen * (T / 2);
      const y0 = groundY(x0, z0) - 0.2;
      const y1 = groundY(x1, z1) - 0.2;
      const u0 = run, u1 = run + segLen;
      for (const side of [1, -1]) {
        const a = [x0 + nx * side, y0, z0 + nz * side];
        const b = [x1 + nx * side, y1, z1 + nz * side];
        const c = [x1 + nx * side, y1 + H, z1 + nz * side];
        const d = [x0 + nx * side, y0 + H, z0 + nz * side];
        if (side > 0) quad(a, b, c, d, [u0, 0], [u1, 0], [u1, H * 2], [u0, H * 2]);
        else quad(b, a, d, c, [u1, 0], [u0, 0], [u0, H * 2], [u1, H * 2]);
      }
      // coping on top
      const cap = new THREE.BoxGeometry(T + 0.14, 0.12, segLen + 0.02);
      cap.rotateY(Math.atan2(x1 - x0, z1 - z0));
      cap.translate(mx, (y0 + y1) / 2 + H + 0.06, mz);
      capGeos.push(cap.toNonIndexed());
      // pillar every ~12 m
      if (Math.round(run / 12) !== Math.round((run + segLen) / 12)) {
        const pil = new THREE.BoxGeometry(0.55, H + 0.35, 0.55);
        pil.translate(x1, y1 + (H + 0.35) / 2, z1);
        capGeos.push(pil.toNonIndexed());
      }
      run += segLen;
    }
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUv, 2));
  wallGeo.computeVertexNormals();
  const wall = new THREE.Mesh(
    wallGeo,
    new THREE.MeshStandardMaterial({ map: brickTexture(), roughness: 0.9, envMapIntensity: 0.2 }),
  );
  wall.castShadow = true;
  wall.receiveShadow = true;
  root.add(wall);
  const caps = mergeGeometries(capGeos, false);
  capGeos.forEach((g) => g.dispose());
  if (caps) {
    const capMesh = new THREE.Mesh(caps, new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8, envMapIntensity: 0.2 }));
    capMesh.castShadow = true;
    root.add(capMesh);
  }
  return root;
}

/**
 * Kachin traditional longhouse (visitor photo + satellite): long narrow plan, very steep
 * dark-grey A-frame roof reaching low, white gable front with a porch, a carved post in
 * front and a low red fence. Local length runs along +z; the front faces +z.
 */
export function buildKachinLonghouse(len: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.85, envMapIntensity: 0.25 });
  const roofMat = new THREE.MeshStandardMaterial({ color: '#4f5457', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.3 });
  const wallH = 2.6;
  const ridge = width * 0.95; // very steep
  // Raised floor and walls
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.8, len), new THREE.MeshStandardMaterial({ color: '#9b9488' }));
  plinth.position.y = 0.4;
  g.add(plinth);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(width - 0.6, wallH, len - 2), white);
  walls.position.y = 0.8 + wallH / 2;
  walls.castShadow = true;
  g.add(walls);
  // Steep A-frame roof: two long slopes with deep eaves, overhanging the front porch
  const half = width / 2 + 0.9;
  const slopeLen = Math.hypot(half, ridge);
  const ang = Math.atan2(ridge, half);
  for (const s of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.18, len + 2.5), roofMat);
    slope.position.set((s * half) / 2, 0.8 + wallH - 0.6 + ridge / 2, 0.8);
    slope.rotation.z = -s * ang;
    slope.castShadow = true;
    g.add(slope);
  }
  // White triangular gable at the front (+z), set back under the eave to form a porch
  const tri = new THREE.Shape();
  tri.moveTo(-width / 2 + 0.3, 0);
  tri.lineTo(width / 2 - 0.3, 0);
  tri.lineTo(0, ridge - 0.4);
  tri.closePath();
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.25, bevelEnabled: false }), white);
  gable.position.set(0, 0.8 + wallH - 0.6, len / 2 - 1);
  g.add(gable);
  // Dark decorative cross-boards on the gable
  const trim = new THREE.MeshStandardMaterial({ color: '#2d2a26' });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, ridge * 0.75, 0.1), trim);
    b.position.set(s * width * 0.18, 0.8 + wallH - 0.6 + ridge * 0.4, len / 2 - 0.7);
    b.rotation.z = s * 0.45;
    g.add(b);
  }
  // Steps and porch floor
  const porch = new THREE.Mesh(new THREE.BoxGeometry(width * 0.7, 0.5, 2.5), new THREE.MeshStandardMaterial({ color: '#7d8f5a' }));
  porch.position.set(0, 0.25, len / 2 + 1.0);
  g.add(porch);
  // Carved Manau-style post in front of the house
  const postTex = canvasTex(64, 256, (c) => {
    const cols = ['#c8102e', '#f2c12e', '#1f7a3a', '#1f4fa0', '#f8f5ec'];
    for (let k = 0; k < 16; k++) {
      c.fillStyle = cols[k % cols.length];
      c.fillRect(0, k * 16, 64, 16);
    }
  });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.5, 10), new THREE.MeshStandardMaterial({ map: postTex, roughness: 0.6 }));
  post.position.set(0, 2.75, len / 2 + 4.2);
  post.castShadow = true;
  g.add(post);
  // Low red fence across the front courtyard
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#8e3b2f', roughness: 0.8 });
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, 0.9, 0.18), fenceMat);
    f.position.set(s * (width * 0.45 + 2.2), 0.45, len / 2 + 6);
    g.add(f);
  }
  return g;
}
