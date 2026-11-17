/**
 * Sutaungpyae Pagoda (ဆုတောင်းပြည့်ဘုရား), Myitkyina — modeled from Google Maps:
 * - Satellite (19z): golden stupa on a ~34 m square tiled terrace, a long hall on its west
 *   side, a taller hall to the north with a big tree between, a red-tiled courtyard running
 *   south to the entrance, and a reclining-Buddha shed to the south-west.
 * - Visitor photos: bell-shaped gold stupa on a square stepped base with four corner
 *   mini-stupas and red-and-gold arched niches, white chinthe guardians, a blue-roofed
 *   offering shelter in front, pink and beige floor tiles, cream halls with grey roofs,
 *   a white arched gate with red pillars under a gold tiered pyatthat roof, and a white
 *   reclining Buddha with a gold robe under an open steel-framed shed with a pink railing.
 *
 * Local frame: meters from the stupa center, +x east, +z south (no rotation).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createRainTreeGeometries } from './manauPark';
import { planarUV } from './textures';

/** Stupa center in world meters (25.39712°N, 97.40533°E). Keep in sync with scripts/build-map-data.mjs. */
export const SUTAUNGPYAE = { x: -49.2, z: 529.0 };

const TERRACE = { x0: -17, x1: 17, z0: -17, z1: 17, h: 0.35 };
const COURT = { x0: -15, x1: 15, z0: 17, z1: 53, h: 0.25 };

/** On the stupa terrace (where visitors pray). */
export function isAtSutaungpyaeTerrace(x: number, z: number): boolean {
  const dx = x - SUTAUNGPYAE.x;
  const dz = z - SUTAUNGPYAE.z;
  return dx > TERRACE.x0 && dx < TERRACE.x1 && dz > TERRACE.z0 && dz < TERRACE.z1;
}

/** Walkable tiled floor height (world), or null outside it. */
export function sutaungpyaeFloorAt(x: number, z: number, groundY: number): number | null {
  const dx = x - SUTAUNGPYAE.x;
  const dz = z - SUTAUNGPYAE.z;
  if (dx > TERRACE.x0 && dx < TERRACE.x1 && dz > TERRACE.z0 && dz < TERRACE.z1) return groundY + TERRACE.h;
  if (dx > COURT.x0 && dx < COURT.x1 && dz > COURT.z0 && dz < COURT.z1) return groundY + COURT.h;
  return null;
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
  box(key: string, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.add(key, g);
  }
  cyl(key: string, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg = 16) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    g.translate(x, y, z);
    this.add(key, g);
  }
  geo(key: string, g: THREE.BufferGeometry, x: number, y: number, z: number) {
    g.translate(x, y, z);
    this.add(key, g);
  }
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Glazed floor tiles: pink-red and beige bands, 60 cm tiles. One texture tile = 2.4 m. */
function floorTileTexture() {
  return canvasTex(256, 256, (g) => {
    const n = 4;
    const s = 256 / n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const band = j === 1 || j === 2;
        const v = Math.random() * 10;
        g.fillStyle = band ? `rgb(${196 + v},${120 + v},${112 + v})` : `rgb(${226 + v},${208 + v},${188 + v})`;
        g.fillRect(i * s, j * s, s, s);
        // glaze highlight
        g.fillStyle = 'rgba(255,255,255,0.10)';
        g.fillRect(i * s + 4, j * s + 4, s * 0.5, s * 0.3);
      }
    }
    g.strokeStyle = 'rgba(120,90,80,0.55)';
    g.lineWidth = 2;
    for (let k = 0; k <= n; k++) {
      g.beginPath();
      g.moveTo(k * s, 0);
      g.lineTo(k * s, 256);
      g.moveTo(0, k * s);
      g.lineTo(256, k * s);
      g.stroke();
    }
  });
}

/** Cream hall wall: arcade of arched openings over a red base. One tile = 4 m × 4.5 m. */
function hallWallTexture(windows: boolean) {
  return canvasTex(160, 180, (g) => {
    g.fillStyle = '#efe6d2';
    g.fillRect(0, 0, 160, 180);
    g.fillStyle = '#9c2f2a';
    g.fillRect(0, 160, 160, 20);
    if (windows) {
      g.fillStyle = '#c9a43a';
      g.fillRect(36, 30, 88, 96);
      g.fillStyle = '#3d3a35';
      g.fillRect(42, 36, 76, 84);
      g.fillStyle = '#d8cfba';
      g.fillRect(78, 36, 4, 84);
    } else {
      g.fillStyle = '#4a3b33';
      g.beginPath();
      g.moveTo(26, 160);
      g.lineTo(26, 70);
      g.arc(80, 70, 54, Math.PI, 0);
      g.lineTo(134, 160);
      g.closePath();
      g.fill();
      g.strokeStyle = '#c9a43a';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(80, 70, 56, Math.PI, 0);
      g.stroke();
    }
  });
}

/** Bell, bands, lotus and banana-bud spire of the stupa as one lathe profile (r, y). */
function stupaProfile(): THREE.Vector2[] {
  const p: [number, number][] = [
    [0, 0],
    [3.7, 0],
    [3.85, 0.9],
    [3.7, 2.2],
    [3.3, 3.6],
    [2.7, 4.8],
    [2.0, 5.8],
    [1.55, 6.4],
    // bands (ring moldings)
    [1.75, 6.5],
    [1.75, 6.8],
    [1.45, 6.9],
    [1.6, 7.0],
    [1.6, 7.3],
    [1.3, 7.4],
    [1.42, 7.5],
    [1.42, 7.75],
    // inverted then upright lotus
    [1.1, 8.1],
    [1.25, 8.5],
    [1.05, 8.9],
    // banana bud
    [0.95, 9.6],
    [0.7, 11.2],
    [0.45, 12.6],
    [0.22, 13.8],
    [0.06, 14.4],
    [0, 14.5],
  ];
  return p.map(([r, y]) => new THREE.Vector2(r, y));
}

function miniStupa(b: Buckets, x: number, y: number, z: number, scale: number) {
  const prof = stupaProfile().map((v) => new THREE.Vector2(v.x * scale, v.y * scale));
  const g = new THREE.LatheGeometry(prof, 20);
  b.geo('gold', g, x, y, z);
  b.box('gold', 2.4 * scale * 2, 0.6, 2.4 * scale * 2, x, y - 0.3, z);
}

function chinthe(b: Buckets, x: number, y: number, z: number, faceZ: 1 | -1) {
  b.box('white', 1.6, 1.0, 1.6, x, y + 0.5, z); // pedestal
  b.box('whiteStatue', 1.0, 1.3, 1.8, x, y + 1.65, z - faceZ * 0.1); // haunches + body
  b.box('whiteStatue', 0.9, 1.4, 0.8, x, y + 2.6, z + faceZ * 0.55); // chest
  b.box('whiteStatue', 1.0, 0.9, 0.9, x, y + 3.6, z + faceZ * 0.75); // head
  b.box('gold', 1.04, 0.25, 0.94, x, y + 4.1, z + faceZ * 0.75); // crown
  b.box('red', 0.5, 0.2, 0.1, x, y + 3.35, z + faceZ * 1.22); // mouth
}

/** White arched gate with red pillars under a gold tiered pyatthat roof, facing ±z. */
function gate(b: Buckets, x: number, z: number) {
  for (const s of [-1, 1]) {
    b.box('white', 1.6, 6.2, 1.6, x + s * 3.6, 3.1, z);
    b.box('red', 0.5, 4.6, 0.5, x + s * 3.6, 2.3, z + 0.85);
    b.box('red', 0.5, 4.6, 0.5, x + s * 3.6, 2.3, z - 0.85);
    b.cyl('red', 0.28, 0.28, 3.4, x + s * 5.4, 1.7, z + 0.9, 10);
    b.box('gold', 0.8, 0.8, 0.8, x + s * 5.4, 3.75, z + 0.9);
  }
  // arch: half ring over the opening
  const arch = new THREE.TorusGeometry(3.6, 0.55, 8, 20, Math.PI);
  arch.scale(1, 1, 2.6);
  b.geo('white', arch, x, 4.6, z);
  b.box('white', 9.2, 1.6, 1.8, x, 7.0, z);
  b.box('red', 9.3, 0.35, 1.85, x, 6.35, z);
  b.box('gold', 9.4, 0.3, 1.9, x, 7.9, z);
  // pyatthat: five shrinking tiers with flared gold eaves
  let y = 8.1;
  for (let t = 0; t < 5; t++) {
    const w = 6.4 - t * 1.15;
    b.box(t % 2 ? 'gold' : 'goldDeep', w * 0.72, 0.7, 1.6 - t * 0.12, x, y + 0.35, z);
    b.box('gold', w, 0.22, 2.2 - t * 0.2, x, y + 0.8, z);
    for (const s of [-1, 1]) b.box('gold', 0.3, 0.7, 0.3, x + s * (w / 2), y + 1.05, z, 0, 0, s * 0.4);
    y += 0.95;
  }
  b.cyl('gold', 0.05, 0.35, 2.2, x, y + 1.1, z, 8);
}

export function createSutaungpyaePagoda(groundY: number): {
  group: THREE.Group;
  colliders: { x: number; z: number; r: number }[];
} {
  const root = new THREE.Group();
  root.position.set(SUTAUNGPYAE.x, groundY, SUTAUNGPYAE.z);
  const b = new Buckets();

  // ---- Floors ----
  const terraceGeo = new THREE.BoxGeometry(TERRACE.x1 - TERRACE.x0, TERRACE.h, TERRACE.z1 - TERRACE.z0);
  terraceGeo.translate(0, TERRACE.h / 2, 0);
  const courtGeo = new THREE.BoxGeometry(COURT.x1 - COURT.x0, COURT.h, COURT.z1 - COURT.z0);
  courtGeo.translate(0, COURT.h / 2, (COURT.z0 + COURT.z1) / 2);
  b.add('tiles', terraceGeo);
  b.add('tiles', courtGeo);
  // white walkway down the courtyard and a white edge around the terrace
  b.box('white', 3.2, 0.04, COURT.z1 - COURT.z0, 0, COURT.h + 0.02, (COURT.z0 + COURT.z1) / 2);
  for (const s of [-1, 1]) {
    b.box('white', 34.4, 0.5, 0.4, 0, 0.25, s * 17.1);
    b.box('white', 0.4, 0.5, 34.4, s * 17.1, 0.25, 0);
  }

  // ---- Stupa ----
  const y0 = TERRACE.h;
  b.box('white', 15.2, 1.1, 15.2, 0, y0 + 0.55, 0);
  b.box('red', 15.3, 0.25, 15.3, 0, y0 + 1.0, 0);
  b.box('gold', 12.6, 1.5, 12.6, 0, y0 + 1.85, 0);
  b.box('gold', 11.2, 0.6, 11.2, 0, y0 + 2.9, 0);
  // arched niches on the four faces (red frame, gold arch, dark shrine inside)
  for (const [nx, nz, ry] of [
    [0, 6.6, 0],
    [0, -6.6, Math.PI],
    [6.6, 0, Math.PI / 2],
    [-6.6, 0, -Math.PI / 2],
  ] as [number, number, number][]) {
    const g = new THREE.Group();
    g.position.set(nx, 0, nz);
    g.rotation.y = ry;
    g.updateMatrixWorld();
    const add = (key: string, geo: THREE.BufferGeometry) => {
      geo.applyMatrix4(g.matrixWorld);
      b.add(key, geo);
    };
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      geo.translate(x, y, z);
      return geo;
    };
    add('red', box(3.4, 3.4, 1.0, 0, y0 + 2.6, 0));
    add('dark', box(1.8, 2.3, 0.2, 0, y0 + 2.25, 0.45));
    const archGeo = new THREE.TorusGeometry(1.1, 0.22, 6, 14, Math.PI);
    archGeo.translate(0, y0 + 3.4, 0.55);
    add('gold', archGeo);
    add('gold', box(0.5, 1.2, 0.5, 0, y0 + 4.7, 0.3));
  }
  // corner mini-stupas
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) miniStupa(b, sx * 5.3, y0 + 3.5, sz * 5.3, 0.3);
  // octagonal terraces, then the bell and spire
  let y = y0 + 3.2;
  for (const [r, h] of [
    [5.0, 0.9],
    [4.5, 0.8],
    [4.05, 0.7],
  ]) {
    b.cyl('gold', r, r, h, 0, y + h / 2, 0, 8);
    y += h;
  }
  b.geo('gold', new THREE.LatheGeometry(stupaProfile(), 40), 0, y, 0);
  const tipY = y + 14.5;
  // hti (umbrella) and vane
  b.cyl('gold', 0.05, 0.55, 0.9, 0, tipY + 0.2, 0, 12);
  b.cyl('white', 0.03, 0.03, 1.4, 0, tipY + 1.2, 0, 6);
  b.box('white', 0.04, 0.4, 0.7, 0, tipY + 1.6, 0.35);

  // ---- Chinthe guardians and the blue offering shelter in front (south) ----
  chinthe(b, -4.6, y0, 11.5, 1);
  chinthe(b, 4.6, y0, 11.5, 1);
  for (const sx of [-2.8, 2.8]) for (const sz of [8.6, 12.4]) b.box('steel', 0.14, 2.7, 0.14, sx, y0 + 1.35, sz);
  b.box('blueRoof', 7.2, 0.18, 5.0, 0, y0 + 2.85, 10.5, 0.12);
  b.box('blueRoof', 7.4, 0.12, 0.5, 0, y0 + 2.6, 13.0);
  b.box('red', 5.0, 0.9, 1.0, 0, y0 + 0.45, 10.2); // offering table
  for (const sx of [-1.6, 0, 1.6]) b.box('glass', 0.8, 0.9, 0.6, sx, y0 + 1.35, 10.2); // donation boxes

  // ---- West hall (tazaung): long, low, cream with grey roof ----
  const hallW = { x0: -28.5, x1: -18.8, z0: -16, z1: 16, h: 4.2 };
  b.box('cream', hallW.x1 - hallW.x0, hallW.h, hallW.z1 - hallW.z0, (hallW.x0 + hallW.x1) / 2, hallW.h / 2, 0);
  for (const s of [-1, 1]) b.box('greyRoof', 5.6, 0.14, 33.6, -23.65 + s * 2.6, hallW.h + 0.75, 0, 0, 0, -s * 0.28);
  b.box('greyRoof', 1.3, 0.12, 32.4, -18.3, 3.3, 0, 0, 0, -0.35); // veranda eave toward the stupa

  // ---- North hall (standing Buddha), taller ----
  const hallN = { x0: -18, x1: 15, z0: -50, z1: -36, h: 9 };
  b.box('cream', hallN.x1 - hallN.x0, hallN.h, hallN.z1 - hallN.z0, (hallN.x0 + hallN.x1) / 2, hallN.h / 2, (hallN.z0 + hallN.z1) / 2);
  for (const s of [-1, 1]) b.box('greyRoof', 34, 0.16, 8.2, -1.5, hallN.h + 1.3, -43 + s * 3.7, s * 0.34);
  // small gold pyatthat on the ridge
  for (let t = 0; t < 3; t++) b.box('gold', 3.2 - t * 0.9, 0.5, 3.2 - t * 0.9, -1.5, hallN.h + 2.9 + t * 0.6, -43);
  b.cyl('gold', 0.04, 0.3, 1.6, -1.5, hallN.h + 5.3, -43, 8);

  // ---- Reclining Buddha under an open steel shed (south-west) ----
  const shed = { cx: -45, cz: 56, w: 34, d: 13 };
  b.box('pinkBase', 30, 1.0, 6.5, shed.cx, 0.5, shed.cz - 1);
  for (let k = 0; k <= 8; k++) {
    const x = shed.cx - shed.w / 2 + (k * shed.w) / 8;
    for (const s of [-1, 1]) b.box('steelDark', 0.35, 8, 0.35, x, 4, shed.cz + s * (shed.d / 2));
    b.box('steelDark', 0.18, 0.4, shed.d, x, 8.2, shed.cz);
  }
  for (const s of [-1, 1]) b.box('zinc', shed.w + 1.5, 0.12, shed.d / 2 + 1.4, shed.cx, 9.0, shed.cz + s * (shed.d / 4 + 0.6), -s * 0.22);
  // pink railing along the open front
  b.box('pinkBase', shed.w, 0.9, 0.3, shed.cx, 0.45, shed.cz + shed.d / 2 + 0.6);
  // the Buddha: head to the west, lying on the right side, facing south
  const bx = shed.cx;
  const by = 1.0;
  const bz = shed.cz - 1.2;
  // body: one smooth capsule along x (white), the gold robe draped over it from chest to ankles
  const body = new THREE.CapsuleGeometry(1.9, 21, 8, 24);
  body.rotateZ(Math.PI / 2);
  body.scale(1, 1.05, 1);
  b.geo('whiteStatue', body, bx + 1.2, by + 2.0, bz);
  const robe = new THREE.CapsuleGeometry(1.98, 18.5, 8, 24, 1);
  robe.rotateZ(Math.PI / 2);
  robe.scale(1, 1.07, 1.02);
  b.geo('robe', robe, bx + 1.6, by + 2.02, bz);
  const hip = new THREE.SphereGeometry(1, 20, 14);
  hip.scale(3.6, 2.5, 2.05);
  b.geo('robe', hip, bx + 2.0, by + 2.3, bz);
  // head resting on the right hand, with the hair and pointed crown in gold
  const head = new THREE.SphereGeometry(1.6, 24, 18);
  head.scale(1, 1.1, 1);
  b.geo('whiteStatue', head, bx - 11.4, by + 3.9, bz + 0.3);
  const hair = new THREE.SphereGeometry(1.66, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  hair.rotateZ(Math.PI / 2);
  b.geo('gold', hair, bx - 11.7, by + 3.9, bz + 0.3);
  const crown = new THREE.ConeGeometry(0.55, 1.4, 12);
  crown.rotateZ(Math.PI / 2);
  b.geo('gold', crown, bx - 13.8, by + 3.9, bz + 0.3);
  b.box('whiteStatue', 1.0, 2.4, 1.0, bx - 11.6, by + 2.1, bz + 0.4); // forearm propping the head
  b.box('gold', 3.4, 1.4, 3.2, bx - 12.0, by + 0.9, bz); // pillow
  const feet = new THREE.SphereGeometry(1, 16, 12);
  feet.scale(1.1, 1.7, 1.2);
  b.geo('whiteStatue', feet, bx + 13.4, by + 2.0, bz);

  // ---- South gate and front wall ----
  gate(b, 0, 55);
  for (const s of [-1, 1]) {
    b.box('white', 9.5, 1.6, 0.35, s * 10.6, 0.8, 55);
    b.box('red', 9.6, 0.18, 0.45, s * 10.6, 1.65, 55);
  }
  chinthe(b, -6.6, 0, 58.5, 1);
  chinthe(b, 6.6, 0, 58.5, 1);

  // ---- Materials ----
  const tiles = floorTileTexture();
  const mats: Record<string, THREE.Material> = {
    tiles: new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.7 }),
    gold: new THREE.MeshStandardMaterial({ color: '#e0a92e', roughness: 0.28, metalness: 0.85, envMapIntensity: 1.1 }),
    white: new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.7, envMapIntensity: 0.4 }),
    whiteStatue: new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.5, envMapIntensity: 0.5 }),
    red: new THREE.MeshStandardMaterial({ color: '#a8282a', roughness: 0.6, envMapIntensity: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.9 }),
    goldDeep: new THREE.MeshStandardMaterial({ color: '#b98523', roughness: 0.35, metalness: 0.8, envMapIntensity: 1.0 }),
    blueRoof: new THREE.MeshStandardMaterial({ color: '#3b6fb6', roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: '#8d9399', roughness: 0.5, metalness: 0.5 }),
    steelDark: new THREE.MeshStandardMaterial({ color: '#4f5458', roughness: 0.55, metalness: 0.5 }),
    zinc: new THREE.MeshStandardMaterial({ color: '#a7adb0', roughness: 0.5, metalness: 0.45, side: THREE.DoubleSide, envMapIntensity: 0.6 }),
    greyRoof: new THREE.MeshStandardMaterial({ color: '#6f767b', roughness: 0.7, metalness: 0.25, side: THREE.DoubleSide, envMapIntensity: 0.4 }),
    cream: new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.85, envMapIntensity: 0.3 }),
    pinkBase: new THREE.MeshStandardMaterial({ color: '#d98a8f', roughness: 0.7, envMapIntensity: 0.3 }),
    robe: new THREE.MeshStandardMaterial({ color: '#d9a12c', roughness: 0.32, metalness: 0.7, envMapIntensity: 1.0 }),
    glass: new THREE.MeshStandardMaterial({ color: '#c9d6dc', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.7 }),
  };
  for (const [key, geos] of b.map) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    if (key === 'tiles') planarUV(merged, 2.4);
    const mesh = new THREE.Mesh(merged, mats[key] ?? mats.white);
    mesh.castShadow = key !== 'tiles';
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // ---- Textured hall walls ----
  const arcade = hallWallTexture(false);
  const windows = hallWallTexture(true);
  const wallPanel = (tex: THREE.Texture, rep: number, w: number, h: number, x: number, z: number, ry: number) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(rep, 1);
    const geo = new THREE.PlaneGeometry(w, h);
    geo.rotateY(ry);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, envMapIntensity: 0.3 }));
    m.position.set(x, h / 2, z);
    root.add(m);
  };
  wallPanel(arcade, 8, 32, 4.2, -18.78, 0, Math.PI / 2); // west hall, facing the stupa
  wallPanel(windows, 8, 33, 9, -1.5, -35.98, 0); // north hall front
  wallPanel(windows, 3, 14, 9, 15.02, -43, Math.PI / 2);
  wallPanel(windows, 3, 14, 9, -18.02, -43, -Math.PI / 2);

  // ---- Big rain trees in the grounds ----
  const rain = createRainTreeGeometries();
  const treeSpots: [number, number, number][] = [
    [0, -27, 1.3],
    [27, -8, 1.1],
    [28, 22, 1.0],
    [-25, 30, 0.95],
    [24, 44, 0.9],
  ];
  const trunk = new THREE.InstancedMesh(rain.trunk, new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.9 }), treeSpots.length);
  const canopy = new THREE.InstancedMesh(rain.canopy, new THREE.MeshStandardMaterial({ color: '#4a7a30', roughness: 0.85, flatShading: true }), treeSpots.length);
  const dummy = new THREE.Object3D();
  treeSpots.forEach(([x, z, s], i) => {
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, i * 1.3, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    canopy.setMatrixAt(i, dummy.matrix);
  });
  trunk.castShadow = true;
  canopy.castShadow = true;
  root.add(trunk, canopy);

  // ---- Colliders (world) ----
  const colliders: { x: number; z: number; r: number }[] = [];
  const c = (x: number, z: number, r: number) => colliders.push({ x: SUTAUNGPYAE.x + x, z: SUTAUNGPYAE.z + z, r });
  c(0, 0, 7.8);
  for (let z = -13; z <= 13; z += 6.5) c(-23.6, z, 5);
  for (let x = -12; x <= 10; x += 7) c(x, -43, 7.2);
  for (let x = -54; x <= -32; x += 5.5) c(x, 54.8, 2.6);
  for (const t of treeSpots) c(t[0], t[1], 0.9 * t[2]);
  return { group: root, colliders };
}
