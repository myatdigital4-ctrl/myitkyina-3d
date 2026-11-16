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
export function buildManauGroundDressing(radius: number, poleTopY: number): THREE.Group {
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
  const from = new THREE.Vector3(0, poleTopY, 0);
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
  tower.position.set(19, 0, 2);
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
