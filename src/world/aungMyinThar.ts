/**
 * Aung Myin Thar (အောင်မြင်သာ) recreation area on the Myitkyina–Myitsone road, about 26 km
 * north of town (25.63982°N, 97.48785°E). Modeled from Google Maps (satellite, visitor photos)
 * and Google Images for "မြစ်ကြီးနား အောင်မြင်သာ":
 * - A clear, blue-green stream over pebbles, running east → west through a wide gravel bed,
 *   with white rapids between big rounded boulders and people floating on inner tubes
 * - A long row of thatched huts on stilts along the south bank, more huts on the north bank
 * - Snack stalls with thatch roofs and green umbrella tables by the road
 * - The road bridge, a yellow steel footbridge to the huts and a cable suspension bridge
 * - Bamboo groves (ဝါးရုံ) on the banks, forested green hills all around
 *
 * It lies far outside the 3 km city map, so it is its own small area at its real coordinates,
 * reached by fast travel. Local frame: meters from the resort pin, +x east, +z south.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRainTreeGeometries } from './manauPark';
import { grassDetailTexture, planarUV } from './textures';

/** Resort pin in world meters (same projection as the city: origin = Manau circle). */
export const AUNG_MYIN_THAR = { x: 8250, z: -26399 };
/** Walkable half-extent around the pin (the hills beyond are the edge). */
const HALF = { x: 300, z: 220 };
const HILL_BAND = 260;

/** Stream centerline, local meters, east → west (traced from the 18z satellite). */
const STREAM: [number, number][] = [
  [330, -52],
  [276, -59],
  [207, -69],
  [138, -86],
  [83, -114],
  [48, -104],
  [21, -76],
  [-14, -41],
  [-69, -24],
  [-138, -14],
  [-237, -17],
  [-330, -26],
];
const WATER_Y = -0.25;

// ---- Stream path sampler (world coordinates), used by the tubing activity ----
const STREAM_DENSE: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i];
    const [bx, bz] = STREAM[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 2);
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  out.push(STREAM[STREAM.length - 1]);
  return out;
})();
const STREAM_CUM: number[] = STREAM_DENSE.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p[0] - STREAM_DENSE[i - 1][0], p[1] - STREAM_DENSE[i - 1][1]));
  return acc;
}, []);
/** Length of the stream centerline (m), east end = 0. */
export const STREAM_LENGTH = STREAM_CUM[STREAM_CUM.length - 1];
/** Point (world) and flow direction at distance s along the stream from its east end. */
export function streamSample(s: number) {
  const t = Math.max(0, Math.min(STREAM_LENGTH, s));
  let i = 1;
  while (i < STREAM_CUM.length - 1 && STREAM_CUM[i] < t) i++;
  const [ax, az] = STREAM_DENSE[i - 1];
  const [bx, bz] = STREAM_DENSE[i];
  const seg = STREAM_CUM[i] - STREAM_CUM[i - 1] || 1;
  const f = (t - STREAM_CUM[i - 1]) / seg;
  const dx = (bx - ax) / seg;
  const dz = (bz - az) / seg;
  return { x: AUNG_MYIN_THAR.x + ax + (bx - ax) * f, z: AUNG_MYIN_THAR.z + az + (bz - az) * f, dirX: dx, dirZ: dz };
}
/** Rapids (local) where the tube speeds up. */
export const STREAM_RAPIDS_LOCAL: [number, number][] = [
  [190, -72],
  [100, -100],
  [35, -92],
  [-30, -34],
  [-190, -15],
];
export const STREAM_WATER_Y = WATER_Y;

/** Fast-travel arrival: by the snack stalls, looking north across the stream. */
export const AUNG_MYIN_THAR_ARRIVAL = { x: AUNG_MYIN_THAR.x - 20, z: AUNG_MYIN_THAR.z + 28, heading: Math.PI };

const toLocal = (x: number, z: number) => ({ x: x - AUNG_MYIN_THAR.x, z: z - AUNG_MYIN_THAR.z });

export function inAungMyinThar(x: number, z: number, margin = 0): boolean {
  const l = toLocal(x, z);
  return Math.abs(l.x) < HALF.x + margin && Math.abs(l.z) < HALF.z + margin;
}

/** Keep (x, z) inside the walkable resort area. */
export function clampToAungMyinThar(x: number, z: number) {
  return {
    x: THREE.MathUtils.clamp(x, AUNG_MYIN_THAR.x - HALF.x, AUNG_MYIN_THAR.x + HALF.x),
    z: THREE.MathUtils.clamp(z, AUNG_MYIN_THAR.z - HALF.z, AUNG_MYIN_THAR.z + HALF.z),
  };
}

/** Distance from a local point to the stream centerline, and the stream direction there. */
function streamInfo(lx: number, lz: number) {
  let best = Infinity;
  let dirX = 1;
  let dirZ = 0;
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i];
    const [bx, bz] = STREAM[i + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const L = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((lx - ax) * vx + (lz - az) * vz) / L));
    const d = Math.hypot(lx - (ax + vx * t), lz - (az + vz * t));
    if (d < best) {
      best = d;
      const len = Math.sqrt(L);
      dirX = vx / len;
      dirZ = vz / len;
    }
  }
  return { d: best, dirX, dirZ };
}

/** Ground height inside the resort area and its surrounding hills, or null elsewhere. */
export function aungMyinTharHeightAt(x: number, z: number): number | null {
  const l = toLocal(x, z);
  if (Math.abs(l.x) > HALF.x + HILL_BAND || Math.abs(l.z) > HALF.z + HILL_BAND) return null;
  const { d } = streamInfo(l.x, l.z);
  const wobble = Math.sin(l.x * 0.05) * 0.25 + Math.cos(l.z * 0.07) * 0.2;
  let h: number;
  if (d < 9) h = THREE.MathUtils.lerp(-0.85, -0.35, THREE.MathUtils.smoothstep(d, 3, 9));
  else if (d < 28) h = THREE.MathUtils.lerp(-0.35, 0.25, THREE.MathUtils.smoothstep(d, 9, 28));
  else h = THREE.MathUtils.lerp(0.25, 0.9, THREE.MathUtils.smoothstep(d, 28, 45)) + wobble * THREE.MathUtils.smoothstep(d, 30, 60);
  // Forested hills rise beyond the walkable area
  const ox = Math.max(0, Math.abs(l.x) - HALF.x + 40);
  const oz = Math.max(0, Math.abs(l.z) - HALF.z + 40);
  const out = Math.hypot(ox, oz);
  if (out > 0 && d > 20) {
    h += Math.min(1, out / 200) ** 1.4 * (48 + Math.sin(l.x * 0.013) * 12 + Math.cos(l.z * 0.017) * 10);
  }
  return h;
}

// ---------------------------------------------------------------------------
let seed = 9137;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  return t;
}

/** Flowing water: blue-green with lighter ripple streaks (scrolled along the stream). */
function waterTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#1f7f7d';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(220,245,240,${0.08 + rand() * 0.18})`;
      g.lineWidth = 1 + rand() * 2;
      const x = rand() * 256;
      const y = rand() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + 10, y + 8, x + 20, y - 8, x + 34 + rand() * 20, y + rand() * 6);
      g.stroke();
    }
  });
}

/** White water foam for the rapids. */
function foamTexture() {
  return canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + rand() * 0.6})`;
      g.beginPath();
      g.ellipse(rand() * 128, rand() * 128, 2 + rand() * 7, 1 + rand() * 3, rand() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** Woven bamboo mat walls. */
function bambooMatTexture() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#c9a66b';
    g.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        g.fillStyle = (x + y) % 16 === 0 ? '#b48d55' : '#d8b97d';
        g.fillRect(x, y, 8, 8);
      }
    }
  });
}

/** Thatch: layered grey-brown grass. */
function thatchTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#8c7a5a';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const v = 90 + rand() * 80;
      g.strokeStyle = `rgba(${v + 30},${v + 18},${v - 10},0.55)`;
      g.beginPath();
      const x = rand() * 128;
      const y = rand() * 128;
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 3, y + 6 + rand() * 8);
      g.stroke();
    }
    g.fillStyle = 'rgba(60,50,35,0.35)';
    for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 2);
  });
}

function signTexture(lines: string[]) {
  return canvasTex(
    512,
    192,
    (g) => {
      g.fillStyle = '#15803d';
      g.fillRect(0, 0, 512, 192);
      g.strokeStyle = '#f8fafc';
      g.lineWidth = 6;
      g.strokeRect(8, 8, 496, 176);
      g.fillStyle = '#f8fafc';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = 'bold 58px "Noto Sans Myanmar", "Myanmar Text", Padauk, "Myanmar Sangam MN", sans-serif';
      g.fillText(lines[0], 256, 74);
      g.font = 'bold 30px "Noto Sans Myanmar", "Myanmar Text", Padauk, sans-serif';
      g.fillText(lines[1], 256, 142);
    },
    false,
  );
}

class Buckets {
  map = new Map<string, THREE.BufferGeometry[]>();
  add(key: string, g: THREE.BufferGeometry) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    let b = this.map.get(key);
    if (!b) this.map.set(key, (b = []));
    b.push(geo);
  }
  box(key: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.add(key, g);
  }
  cyl(key: string, r: number, h: number, x: number, y: number, z: number, seg = 8) {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
    g.translate(x, y, z);
    this.add(key, g);
  }
}

/** Ground height in local coordinates. */
const hl = (lx: number, lz: number) => aungMyinTharHeightAt(lx + AUNG_MYIN_THAR.x, lz + AUNG_MYIN_THAR.z) ?? 0.9;

/** Thatched hut on stilts; door side faces +z of its own frame. */
function hut(b: Buckets, x: number, z: number, ry: number, w = 5, d = 6) {
  const y0 = hl(x, z);
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.rotation.y = ry;
  g.updateMatrixWorld();
  const put = (key: string, geo: THREE.BufferGeometry) => {
    geo.applyMatrix4(g.matrixWorld);
    b.add(key, geo);
  };
  const bx = (w2: number, h: number, d2: number, px: number, py: number, pz: number, rx = 0, rz = 0) => {
    const geo = new THREE.BoxGeometry(w2, h, d2);
    if (rx) geo.rotateX(rx);
    if (rz) geo.rotateZ(rz);
    geo.translate(px, py, pz);
    return geo;
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('pole', bx(0.16, 1.4, 0.16, sx * (w / 2 - 0.2), 0.7, sz * (d / 2 - 0.2)));
  put('plank', bx(w, 0.12, d + 1.2, 0, 1.36, 0.6)); // floor with a front porch
  put('mat', bx(w - 0.2, 1.1, 0.06, 0, 1.95, -d / 2 + 0.1)); // back wall
  for (const s of [-1, 1]) put('mat', bx(0.06, 0.8, d - 0.4, s * (w / 2 - 0.1), 1.8, 0)); // low side walls
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('pole', bx(0.12, 2.2, 0.12, sx * (w / 2 - 0.2), 2.5, sz * (d / 2 - 0.2)));
  // steep thatch gable roof with a deep overhang
  for (const s of [-1, 1]) put('thatch', bx(w / 2 + 1.0, 0.18, d + 2.2, s * (w / 4 + 0.35), 4.05, 0.3, 0, -s * 0.62));
  put('pole', bx(0.14, 0.14, d + 2.2, 0, 4.7, 0.3));
}

/** Snack stall: thatch roof on four posts, counter with goods, a hanging banner. */
function stall(b: Buckets, x: number, z: number, ry: number) {
  const y0 = hl(x, z);
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.rotation.y = ry;
  g.updateMatrixWorld();
  const put = (key: string, geo: THREE.BufferGeometry) => {
    geo.applyMatrix4(g.matrixWorld);
    b.add(key, geo);
  };
  const bx = (w2: number, h: number, d2: number, px: number, py: number, pz: number, rz = 0) => {
    const geo = new THREE.BoxGeometry(w2, h, d2);
    if (rz) geo.rotateZ(rz);
    geo.translate(px, py, pz);
    return geo;
  };
  for (const sx of [-1.6, 1.6]) for (const sz of [-1.4, 1.4]) put('pole', bx(0.12, 2.6, 0.12, sx, 1.3, sz));
  for (const s of [-1, 1]) put('thatch', bx(2.2, 0.15, 3.8, s * 0.95, 2.85, 0, -s * 0.45));
  put('plank', bx(3.2, 0.9, 0.7, 0, 0.45, 1.1)); // counter
  const goods = ['goodsRed', 'goodsYellow', 'goodsGreen', 'goodsBlue', 'goodsOrange'];
  for (let i = 0; i < 9; i++) {
    put(goods[i % goods.length], bx(0.25 + rand() * 0.15, 0.25 + rand() * 0.3, 0.25, -1.3 + i * 0.32, 1.05, 1.1));
  }
  put('goodsOrange', bx(3.0, 0.5, 0.04, 0, 2.35, 1.42)); // banner strip
  put('plank', bx(2.8, 1.6, 0.1, 0, 1.0, -1.35)); // back shelf
}

/** Green garden umbrella over a small table with plastic chairs. */
function umbrellaTable(b: Buckets, x: number, z: number) {
  const y0 = hl(x, z);
  b.cyl('pole', 0.04, 2.3, x, y0 + 1.15, z, 6);
  const canopy = new THREE.ConeGeometry(1.5, 0.6, 8);
  canopy.translate(x, y0 + 2.4, z);
  b.add('umbrella', canopy);
  b.cyl('chair', 0.45, 0.06, x, y0 + 0.72, z, 10);
  b.cyl('chair', 0.05, 0.7, x, y0 + 0.36, z, 6);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    b.box('chair', 0.42, 0.42, 0.42, x + Math.cos(a) * 0.9, y0 + 0.21, z + Math.sin(a) * 0.9);
  }
}

export interface AungMyinTharWorld {
  group: THREE.Group;
  colliders: { x: number; z: number; r: number }[];
  update: (elapsed: number) => void;
}

export function createAungMyinThar(): AungMyinTharWorld {
  const root = new THREE.Group();
  root.position.set(AUNG_MYIN_THAR.x, 0, AUNG_MYIN_THAR.z);
  const colliders: { x: number; z: number; r: number }[] = [];
  const col = (lx: number, lz: number, r: number) => colliders.push({ x: AUNG_MYIN_THAR.x + lx, z: AUNG_MYIN_THAR.z + lz, r });

  // ---- Ground: gravel bed by the stream, grass, forested hills ----
  const W = (HALF.x + HILL_BAND) * 2;
  const D = (HALF.z + HILL_BAND) * 2;
  const ground = new THREE.PlaneGeometry(W, D, 180, 150);
  ground.rotateX(-Math.PI / 2);
  const pos = ground.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cGravel = new THREE.Color('#8f8570');
  const cWet = new THREE.Color('#58645a');
  const cGrass = new THREE.Color('#4a7530');
  const cForest = new THREE.Color('#22421f');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = hl(x, z);
    pos.setY(i, y);
    const { d } = streamInfo(x, z);
    if (d < 9) tmp.copy(cWet);
    else if (d < 30) tmp.copy(cWet).lerp(cGravel, THREE.MathUtils.smoothstep(d, 9, 16));
    else tmp.copy(cGravel).lerp(cGrass, THREE.MathUtils.smoothstep(d, 30, 42));
    tmp.lerp(cForest, THREE.MathUtils.smoothstep(y, 2, 14));
    const n = 0.92 + rand() * 0.12;
    colors[i * 3] = tmp.r * n;
    colors[i * 3 + 1] = tmp.g * n;
    colors[i * 3 + 2] = tmp.b * n;
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  planarUV(ground, 5);
  const groundMesh = new THREE.Mesh(
    ground,
    new THREE.MeshStandardMaterial({ vertexColors: true, map: grassDetailTexture(), roughness: 0.95, envMapIntensity: 0.25 }),
  );
  groundMesh.receiveShadow = true;
  root.add(groundMesh);

  // ---- Stream water ribbon (width varies; pools near the huts) ----
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  const dense: [number, number][] = [];
  for (let i = 0; i < STREAM.length - 1; i++) {
    const [ax, az] = STREAM[i];
    const [bx, bz] = STREAM[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  dense.push(STREAM[STREAM.length - 1]);
  const uvs: number[] = [];
  let run = 0;
  for (let i = 0; i < dense.length; i++) {
    const [x, z] = dense[i];
    const [nx, nz] = dense[Math.min(i + 1, dense.length - 1)];
    const [px, pz] = dense[Math.max(i - 1, 0)];
    let tx = nx - px;
    let tz = nz - pz;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const halfW = 8 + Math.sin(i * 0.35) * 2.5 + (x > -130 && x < -40 ? 4 : 0);
    left.push(new THREE.Vector3(x - tz * halfW, WATER_Y, z + tx * halfW));
    right.push(new THREE.Vector3(x + tz * halfW, WATER_Y, z - tx * halfW));
    if (i > 0) run += Math.hypot(x - dense[i - 1][0], z - dense[i - 1][1]);
    uvs.push(run / 12);
  }
  const wPos: number[] = [];
  const wUv: number[] = [];
  for (let i = 0; i < dense.length - 1; i++) {
    const a = left[i];
    const b2 = right[i];
    const c = right[i + 1];
    const d2 = left[i + 1];
    wPos.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d2.x, d2.y, d2.z);
    wUv.push(uvs[i], 0, uvs[i], 1, uvs[i + 1], 1, uvs[i], 0, uvs[i + 1], 1, uvs[i + 1], 0);
  }
  const waterGeo = new THREE.BufferGeometry();
  waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(wPos, 3));
  waterGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wUv, 2));
  waterGeo.computeVertexNormals();
  const waterTex = waterTexture();
  waterTex.repeat.set(1, 1.5);
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex,
    color: '#5f9f9a', // clear blue-green over dark pebbles (photos)
    transparent: true,
    opacity: 0.82,
    roughness: 0.18,
    metalness: 0,
    envMapIntensity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.renderOrder = 2;
  root.add(water);

  // ---- Rapids: foam patches over boulder fields ----
  const foamTex = foamTexture();
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.9 });
  const rapids: [number, number, number][] = [
    [190, -72, 14],
    [100, -100, 12],
    [35, -92, 11],
    [-30, -34, 10],
    [-190, -15, 12],
  ];
  const foamMeshes: THREE.Mesh[] = [];
  for (const [x, z, s] of rapids) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 1.6, s), foamMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rand() * Math.PI;
    m.position.set(x, WATER_Y + 0.05, z);
    m.renderOrder = 3;
    root.add(m);
    foamMeshes.push(m);
  }

  // ---- Boulders: big rounded rocks in the channel and on the gravel bed ----
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });
  const ROCKS = 380;
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, ROCKS);
  const dummy = new THREE.Object3D();
  const rockColor = new THREE.Color();
  let placed = 0;
  for (let tries = 0; placed < ROCKS && tries < 4000; tries++) {
    const seg = Math.floor(rand() * dense.length);
    const [sx, sz] = dense[seg];
    const nearRapid = rapids.some(([rx, rz]) => Math.hypot(rx - sx, rz - sz) < 22);
    const spread = nearRapid ? 14 : 26;
    const x = sx + (rand() - 0.5) * spread * 2;
    const z = sz + (rand() - 0.5) * spread * 2;
    const { d } = streamInfo(x, z);
    if (d > 30) continue;
    const big = nearRapid && rand() < 0.5;
    const r = big ? 0.9 + rand() * 1.4 : 0.25 + rand() * 0.7;
    dummy.position.set(x, hl(x, z) + r * 0.25, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(r * (1 + rand() * 0.4), r * (0.55 + rand() * 0.3), r * (1 + rand() * 0.3));
    dummy.updateMatrix();
    rocks.setMatrixAt(placed, dummy.matrix);
    const v = 0.28 + rand() * 0.2;
    rockColor.setRGB(v * 1.08, v, v * 0.88);
    rocks.setColorAt(placed, rockColor);
    placed++;
  }
  rocks.count = placed;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  root.add(rocks);

  // ---- Bamboo groves (ဝါးရုံ) on the banks ----
  const culmGeo = new THREE.CylinderGeometry(0.06, 0.09, 1, 6);
  culmGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  const culms = new THREE.InstancedMesh(culmGeo, new THREE.MeshStandardMaterial({ color: '#5f7a26', roughness: 0.6 }), 1400);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#3f6f22', roughness: 0.8, flatShading: true }), 1400);
  let nc = 0;
  let nl = 0;
  for (let clump = 0, tries = 0; clump < 95 && tries < 2000; tries++) {
    const x = (rand() - 0.5) * (HALF.x * 2 + 100);
    const z = (rand() - 0.5) * (HALF.z * 2 + 100);
    const { d } = streamInfo(x, z);
    if (d < 32 || d > 120) continue;
    if (x > -150 && x < 60 && z > -5 && z < 60) continue; // huts, stalls, road side
    clump++;
    const y = hl(x, z);
    const stems = 8 + Math.floor(rand() * 7);
    for (let s = 0; s < stems && nc < 1400; s++) {
      const a = rand() * Math.PI * 2;
      const lean = 0.08 + rand() * 0.25;
      const hgt = 8 + rand() * 7;
      dummy.position.set(x + Math.cos(a) * rand() * 1.2, y, z + Math.sin(a) * rand() * 1.2);
      dummy.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
      dummy.scale.set(1, hgt, 1);
      dummy.updateMatrix();
      culms.setMatrixAt(nc++, dummy.matrix);
      if (nl < 1400) {
        // feathery leaf mass toward the arching top
        const top = new THREE.Vector3(0, hgt * 0.85, 0).applyEuler(dummy.rotation).add(dummy.position);
        dummy.position.copy(top);
        dummy.rotation.set(rand(), rand() * 3, rand());
        dummy.scale.set(1.6 + rand(), 0.9 + rand() * 0.6, 1.4 + rand());
        dummy.updateMatrix();
        leaves.setMatrixAt(nl++, dummy.matrix);
      }
    }
  }
  culms.count = nc;
  leaves.count = nl;
  culms.castShadow = true;
  leaves.castShadow = true;
  root.add(culms, leaves);

  // ---- Forest on the hills ----
  const rain = createRainTreeGeometries();
  const TREES = 420;
  const trunks = new THREE.InstancedMesh(rain.trunk, new THREE.MeshStandardMaterial({ color: '#4d3b2c', roughness: 0.9 }), TREES);
  const crowns = new THREE.InstancedMesh(rain.canopy, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }), TREES);
  const green = new THREE.Color();
  let nt = 0;
  for (let tries = 0; nt < TREES && tries < 6000; tries++) {
    const x = (rand() - 0.5) * W * 0.95;
    const z = (rand() - 0.5) * D * 0.95;
    const inside = Math.abs(x) < HALF.x - 30 && Math.abs(z) < HALF.z - 30;
    const { d } = streamInfo(x, z);
    if (d < 45) continue;
    if (inside && rand() < 0.8) continue; // open meadows inside, dense forest on the hills
    if (x > -160 && x < 200 && z > -10 && z < 200 && inside) continue;
    const s = 0.7 + rand() * 0.7;
    dummy.position.set(x, hl(x, z) - 0.2, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.set(s, s * (0.9 + rand() * 0.4), s);
    dummy.updateMatrix();
    trunks.setMatrixAt(nt, dummy.matrix);
    crowns.setMatrixAt(nt, dummy.matrix);
    green.setHSL(0.27 + rand() * 0.06, 0.5, 0.14 + rand() * 0.08);
    crowns.setColorAt(nt, green);
    nt++;
  }
  trunks.count = nt;
  crowns.count = nt;
  trunks.castShadow = true;
  crowns.castShadow = true;
  root.add(trunks, crowns);

  // ---- Built things (merged by material) ----
  const b = new Buckets();
  // Hut row along the south bank, facing the water (north)
  for (let k = 0; k < 13; k++) {
    const x = -150 + k * 8.2;
    const z = 2 + k * 1.6 + (k % 2) * 0.6;
    hut(b, x, z, Math.PI);
    col(x, z, 3.4);
  }
  // A few on the north bank
  for (let k = 0; k < 5; k++) {
    const x = -120 + k * 9;
    const z = -48 - k * 1.2;
    hut(b, x, z, 0);
    col(x, z, 3.4);
  }
  // Snack stalls and umbrella tables by the road, south of the bridge
  const stallSpots: [number, number, number][] = [
    [-6, 18, Math.PI * 0.8],
    [2, 26, Math.PI * 0.8],
    [10, 34, Math.PI * 0.8],
    [-30, 40, Math.PI],
    [-22, 46, Math.PI],
  ];
  for (const [x, z, r] of stallSpots) {
    stall(b, x, z, r);
    col(x, z, 2.2);
  }
  for (const [x, z] of [
    [-24, 22],
    [-16, 28],
    [-34, 28],
    [-8, 38],
    [-40, 18],
  ] as [number, number][]) umbrellaTable(b, x, z);

  // Road: laterite strip from the NW, over the bridge, away to the SE
  const roadPts: [number, number][] = [
    [-170, -170],
    [-69, -72],
    [-41, -35],
    [10, 15],
    [131, 124],
    [200, 200],
  ];
  const roadGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < roadPts.length - 1; i++) {
    const [ax, az] = roadPts[i];
    const [bx, bz] = roadPts[i + 1];
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
    for (let k = 0; k < n; k++) {
      const x = ax + ((bx - ax) * (k + 0.5)) / n;
      const z = az + ((bz - az) * (k + 0.5)) / n;
      const { d } = streamInfo(x, z);
      if (d < 22) continue; // the bridge spans this part
      const seg = new THREE.BoxGeometry(6.5, 0.12, Math.hypot(bx - ax, bz - az) / n + 0.4);
      seg.rotateY(Math.atan2(bx - ax, bz - az));
      seg.translate(x, hl(x, z) + 0.06, z);
      roadGeos.push(seg.toNonIndexed());
    }
  }
  for (const g of roadGeos) b.add('road', g);
  // Road bridge (concrete deck and white railings) where the road crosses the stream
  {
    const [ax, az] = [-69, -72];
    const [bx, bz] = [-14, -2];
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bx - ax, bz - az);
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    const deck = new THREE.BoxGeometry(7, 0.5, len);
    deck.rotateY(ang);
    deck.translate(cx, 1.3, cz);
    b.add('concrete', deck);
    for (const s of [-1, 1]) {
      const rail = new THREE.BoxGeometry(0.2, 0.9, len);
      rail.translate(s * 3.4, 2.0, 0);
      rail.rotateY(ang);
      rail.translate(cx, 0, cz);
      b.add('whiteRail', rail);
    }
    for (const t of [0.3, 0.5, 0.7]) {
      const pier = new THREE.BoxGeometry(6, 2.2, 0.8);
      pier.rotateY(ang);
      pier.translate(ax + (bx - ax) * t, 0.0, az + (bz - az) * t);
      b.add('concrete', pier);
    }
  }
  // Yellow steel footbridge from the hut row across to the north bank
  {
    const x = -96;
    const z0 = 0;
    const z1 = -42;
    const len = z0 - z1;
    b.box('yellowSteel', 2.0, 0.15, len, x, 1.5, (z0 + z1) / 2);
    for (const s of [-1, 1]) {
      b.box('yellowSteel', 0.08, 0.08, len, x + s, 2.45, (z0 + z1) / 2);
      b.box('yellowSteel', 0.06, 0.06, len, x + s, 1.95, (z0 + z1) / 2);
      for (let k = 0; k <= len; k += 1.5) b.box('yellowSteel', 0.06, 1.0, 0.06, x + s, 1.95, z0 - k);
    }
    for (const z of [-12, -21, -30]) b.box('darkSteel', 0.3, 2.4, 0.3, x, 0.3, z);
  }
  // Cable suspension bridge upstream, with the name board over the entrance
  {
    const x = 138;
    const zN = -116;
    const zS = -58;
    const len = zS - zN;
    for (const z of [zN, zS]) {
      for (const s of [-1, 1]) b.box('darkSteel', 0.25, 6, 0.25, x + s * 1.1, hl(x, z) + 3, z);
      b.box('darkSteel', 2.5, 0.25, 0.25, x, hl(x, z) + 6, z);
    }
    // sagging deck and cables
    const n = 24;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const z = zN + len * t;
      const sag = Math.sin(t * Math.PI) * 1.4;
      b.box('plank', 1.6, 0.08, len / n + 0.05, x, 2.4 - sag, z);
      for (const s of [-1, 1]) {
        b.box('darkSteel', 0.04, 0.04, len / n + 0.05, x + s * 0.9, 3.6 - sag, z);
        b.box('darkSteel', 0.03, 1.2, 0.03, x + s * 0.9, 3.0 - sag, z);
      }
    }
  }

  const thatchTex = thatchTexture();
  thatchTex.repeat.set(2, 2);
  const matTex = bambooMatTexture();
  matTex.repeat.set(3, 1);
  const mats: Record<string, THREE.Material> = {
    pole: new THREE.MeshStandardMaterial({ color: '#6b4f33', roughness: 0.85 }),
    plank: new THREE.MeshStandardMaterial({ color: '#9b7a50', roughness: 0.85 }),
    mat: new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.9 }),
    thatch: new THREE.MeshStandardMaterial({ map: thatchTex, roughness: 1, side: THREE.DoubleSide }),
    goodsRed: new THREE.MeshStandardMaterial({ color: '#d63a2f', roughness: 0.5 }),
    goodsYellow: new THREE.MeshStandardMaterial({ color: '#f2c12e', roughness: 0.5 }),
    goodsGreen: new THREE.MeshStandardMaterial({ color: '#3fae4a', roughness: 0.5 }),
    goodsBlue: new THREE.MeshStandardMaterial({ color: '#2f6fd1', roughness: 0.5 }),
    goodsOrange: new THREE.MeshStandardMaterial({ color: '#f08a24', roughness: 0.5 }),
    umbrella: new THREE.MeshStandardMaterial({ color: '#2f9e44', roughness: 0.6, side: THREE.DoubleSide }),
    chair: new THREE.MeshStandardMaterial({ color: '#e8eef2', roughness: 0.5 }),
    road: new THREE.MeshStandardMaterial({ color: '#a8754e', roughness: 0.95 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#b9b6ae', roughness: 0.9 }),
    whiteRail: new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.6 }),
    yellowSteel: new THREE.MeshStandardMaterial({ color: '#f2c41a', roughness: 0.45, metalness: 0.4 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#3c4146', roughness: 0.5, metalness: 0.6 }),
  };
  for (const [key, geos] of b.map) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    if (key === 'thatch' || key === 'mat') planarUV(merged, 2);
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.castShadow = key !== 'road';
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // Thatch textures need UVs along the slope too: planarUV on x/z is close enough for a roof.

  // ---- Signboards ----
  const sign = (lx: number, lz: number, ry: number, lines: string[]) => {
    const y0 = hl(lx, lz);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.6), new THREE.MeshStandardMaterial({ map: signTexture(lines), roughness: 0.6, side: THREE.DoubleSide }));
    board.position.set(lx, y0 + 2.6, lz);
    board.rotation.y = ry;
    root.add(board);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), mats.darkSteel);
      post.position.set(lx + Math.cos(ry) * s * 1.8, y0 + 1.7, lz - Math.sin(ry) * s * 1.8);
      root.add(post);
    }
  };
  sign(60, 70, Math.PI * 0.75, ['အောင်မြင်သာ', 'အပန်းဖြေစခန်း · မြစ်ကြီးနား–မြစ်ဆုံလမ်း']);
  sign(138, -54, 0, ['အောင်မြင်သာ', 'ဆွဲကြိုးတံတား']);

  // ---- People floating on inner tubes, drifting downstream ----
  const tubeMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.7 });
  const shirts = ['#e24a3b', '#2f7fd8', '#f2c12e', '#ffffff', '#3fae4a'];
  const tubers: { g: THREE.Group; offset: number; speed: number }[] = [];
  for (let k = 0; k < 7; k++) {
    const g = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 8, 16), tubeMat);
    tube.rotation.x = Math.PI / 2;
    g.add(tube);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.3), new THREE.MeshStandardMaterial({ color: shirts[k % shirts.length] }));
    body.position.y = 0.3;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshStandardMaterial({ color: '#b07a52' }));
    head.position.y = 0.68;
    g.add(head);
    root.add(g);
    tubers.push({ g, offset: rand(), speed: 0.006 + rand() * 0.004 });
  }
  // Total length along the dense polyline, for drifting
  const cum: number[] = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = cum[cum.length - 1];
  const pointAt = (s: number) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [dense[i - 1][0] + (dense[i][0] - dense[i - 1][0]) * t, dense[i - 1][1] + (dense[i][1] - dense[i - 1][1]) * t];
  };

  const update = (elapsed: number) => {
    waterTex.offset.x = -elapsed * 0.35;
    foamTex.offset.set(Math.sin(elapsed * 3) * 0.04, -elapsed * 0.6);
    foamMeshes.forEach((m, i) => {
      (m.material as THREE.MeshBasicMaterial).opacity = 0.75 + Math.sin(elapsed * 4 + i) * 0.15;
    });
    for (const tb of tubers) {
      // Drift the calmer middle stretch (by the huts) and loop
      const s = total * (0.45 + ((tb.offset + elapsed * tb.speed) % 1) * 0.35);
      const [x, z] = pointAt(s);
      tb.g.position.set(x + Math.sin(elapsed * 0.7 + tb.offset * 9) * 2.5, WATER_Y + 0.05 + Math.sin(elapsed * 2 + tb.offset * 6) * 0.05, z);
      tb.g.rotation.y = elapsed * 0.3 + tb.offset * 6;
    }
  };

  // Match the city's materials: little environment light, so colors stay natural, not washed out
  const toned = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const mm of Array.isArray(m) ? m : m ? [m] : []) {
      if (toned.has(mm)) continue; // shared materials: tone once
      toned.add(mm);
      if (mm instanceof THREE.MeshStandardMaterial && mm !== waterMat) {
        mm.envMapIntensity = 0.25;
        // The game's noon light is strong (sun + sky + environment), so pale gravel and grey
        // rock would burn out to white; tone every albedo down to keep the photo colors
        mm.color.multiplyScalar(0.62);
      }
    }
  });

  return { group: root, colliders, update };
}
