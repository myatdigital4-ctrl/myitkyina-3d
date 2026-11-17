/**
 * Myitkyina Railway Station (မြစ်ကြီးနား ဘူတာ), modeled from Google Maps:
 * - Satellite: a 64 m × 16 m building (the OSM footprint) facing east across a forecourt to
 *   Tha Khin Net Hpay Street, a long dark platform canopy on its west side, four tracks with
 *   wagons, an island platform with a long low shed, and one more track beyond it.
 * - Visitor photos: a cream two-storey concrete building with a flat roof, continuous bands of
 *   dark-framed windows, grey pilasters, a three-storey center tower with the station sign and
 *   a flagpole, end wings with grey-blue lattice panels, a steel-truss platform canopy on white
 *   columns with green bases, red-brown boxcars, cream coaches and a red-and-blue DF diesel.
 *   The forecourt has a steel fence on a red-and-white curb and light trucks with green canopies.
 *
 * Built in a local frame (u = x across the tracks, + toward the street; v = z along them,
 * + south) and rotated onto the real alignment.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { concreteDetailTexture, gravelTexture, planarUV } from './textures';

/** Center of the OSM station footprint (world meters) and the track bearing. Keep in sync with scripts/build-map-data.mjs. */
export const STATION = { x: -716.75, z: 2391.1, th: 0.063 };

const COS = Math.cos(STATION.th);
const SIN = Math.sin(STATION.th);

/** World → station-local (u across, v along). */
export function stationLocal(x: number, z: number) {
  const dx = x - STATION.x;
  const dz = z - STATION.z;
  return { u: dx * COS - dz * SIN, v: dx * SIN + dz * COS };
}

/** Station-local → world. */
export function stationWorld(u: number, v: number) {
  return { x: STATION.x + u * COS + v * SIN, z: STATION.z - u * SIN + v * COS };
}

// ---- Layout (local meters) ----------------------------------------------------
const BLD = { u0: -8, u1: 8, v0: -32, v1: 32, h: 8.8 };
const PLATFORM_H = 0.85;
const PLATFORM_1 = { u0: -18, u1: -8, v0: -42, v1: 62 };
const ISLAND = { u0: -46.6, u1: -35.6, v0: 8, v1: 140 };
const TRACKS: { u: number; v0: number; v1: number }[] = [
  { u: -20.2, v0: -125, v1: 150 },
  { u: -24.6, v0: -125, v1: 150 },
  { u: -29.0, v0: -125, v1: 150 },
  { u: -33.4, v0: -70, v1: 150 },
  { u: -48.8, v0: -40, v1: 150 },
];
const BALLAST = { u0: -51.6, u1: -17.6, v0: -128, v1: 152 };
const RAIL_TOP = 0.3 + 0.14 + 0.15;
const FENCE_U = 41;
const FENCE_GAPS: [number, number][] = [
  [-28.5, -20.5], // driveway out (north)
  [18, 26], // driveway in (south)
];

/** Walkable raised surfaces: platform top height in world space, or null. */
export function stationPlatformTopAt(x: number, z: number, groundY: number): number | null {
  const { u, v } = stationLocal(x, z);
  for (const p of [PLATFORM_1, ISLAND]) {
    if (u > p.u0 && u < p.u1 && v > p.v0 && v < p.v1) return groundY + PLATFORM_H;
  }
  return null;
}

/** True inside the rail yard or forecourt (keep trees, NPCs and props out). */
export function isInStationYard(x: number, z: number, margin = 0): boolean {
  const { u, v } = stationLocal(x, z);
  if (u > -58 - margin && u < -9 + margin && v > -135 - margin && v < 160 + margin) return true;
  return u > 8 - margin && u < 42 + margin && v > -35 - margin && v < 35 + margin;
}

// ---- Geometry buckets ------------------------------------------------------------
type Bucket = THREE.BufferGeometry[];
class Buckets {
  map = new Map<string, Bucket>();
  add(key: string, g: THREE.BufferGeometry) {
    let b = this.map.get(key);
    if (!b) this.map.set(key, (b = []));
    b.push(g);
  }
  box(key: string, w: number, h: number, d: number, x: number, y: number, z: number, rz = 0, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.add(key, g);
  }
  cyl(key: string, r: number, h: number, x: number, y: number, z: number, seg = 10) {
    const g = new THREE.CylinderGeometry(r, r, h, seg);
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

let seed = 4242;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const CREAM = '#ebe5d5';

/** Dark-framed window band with mullions (one bay, 40 px per meter). */
function drawWindowRow(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number) {
  g.fillStyle = '#c8c2b4';
  g.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
  g.fillStyle = '#34424a';
  g.fillRect(x0, y0, w, h);
  // glass reflections
  g.fillStyle = 'rgba(160,185,200,0.25)';
  g.fillRect(x0, y0, w, h * 0.35);
  g.fillStyle = '#d9d4c7';
  const panes = Math.max(2, Math.round(w / 22));
  for (let k = 1; k < panes; k++) g.fillRect(x0 + (k * w) / panes - 1.5, y0, 3, h);
  g.fillRect(x0, y0 + h * 0.38, w, 3);
}

function weather(g: CanvasRenderingContext2D, w: number, h: number) {
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(90,85,75,${0.03 + rand() * 0.05})`;
    const x = rand() * w;
    g.fillRect(x, rand() * h * 0.5, 2 + rand() * 6, h * (0.2 + rand() * 0.6));
  }
}

/** Two-storey bay: arcade with doors below, window band above. 3.8 m × 8.4 m. */
function facadeBayTexture() {
  return canvasTex(152, 336, (g) => {
    g.fillStyle = CREAM;
    g.fillRect(0, 0, 152, 336);
    drawWindowRow(g, 10, 44, 132, 88);
    // floor slab line
    g.fillStyle = '#cfc8b8';
    g.fillRect(0, 170, 152, 14);
    // ground-floor veranda opening between piers
    g.fillStyle = '#5a554c';
    g.fillRect(14, 200, 124, 136);
    g.fillStyle = '#2f2b27';
    g.fillRect(48, 232, 56, 104);
    drawWindowRow(g, 20, 214, 22, 40);
    drawWindowRow(g, 110, 214, 22, 40);
    weather(g, 152, 336);
  });
}

/** Center tower: three window bands over the entrance. 3.5 m × 12.4 m per bay. */
function towerBayTexture() {
  return canvasTex(140, 496, (g) => {
    g.fillStyle = CREAM;
    g.fillRect(0, 0, 140, 496);
    drawWindowRow(g, 12, 56, 116, 78); // third floor
    g.fillStyle = '#cfc8b8';
    g.fillRect(0, 150, 140, 10);
    drawWindowRow(g, 12, 196, 116, 86); // second floor
    g.fillStyle = '#cfc8b8';
    g.fillRect(0, 316, 140, 14);
    g.fillStyle = '#4c4740';
    g.fillRect(10, 350, 120, 146); // entrance hall
    g.fillStyle = '#2a2622';
    g.fillRect(36, 380, 68, 116);
    weather(g, 140, 496);
  });
}

/** Grey-blue concrete lattice screen on the end wings. One tile = 1 m. */
function latticeTexture() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#d6d2c6';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#6f8592';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-8, 32);
    g.lineTo(32, -8);
    g.lineTo(72, 32);
    g.lineTo(32, 72);
    g.closePath();
    g.stroke();
    g.fillStyle = '#3e4a52';
    g.beginPath();
    g.moveTo(32, 14);
    g.lineTo(50, 32);
    g.lineTo(32, 50);
    g.lineTo(14, 32);
    g.closePath();
    g.fill();
  });
}

function stationSignTexture() {
  return canvasTex(768, 128, (g) => {
    g.fillStyle = '#f7f5ef';
    g.fillRect(0, 0, 768, 128);
    g.strokeStyle = '#1d3b6e';
    g.lineWidth = 6;
    g.strokeRect(4, 4, 760, 120);
    g.fillStyle = '#1d3b6e';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 50px "Noto Sans Myanmar", "Myanmar Text", Padauk, "Myanmar Sangam MN", sans-serif';
    g.fillText('မြစ်ကြီးနား ဘူတာ', 384, 46);
    g.font = 'bold 30px Arial, sans-serif';
    g.fillText('MYITKYINA RAILWAY STATION', 384, 100);
  });
}

function platformNameTexture() {
  return canvasTex(512, 160, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 512, 160);
    g.fillStyle = '#111111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 54px "Noto Sans Myanmar", "Myanmar Text", Padauk, "Myanmar Sangam MN", sans-serif';
    g.fillText('မြစ်ကြီးနား', 256, 56);
    g.font = 'bold 44px Arial, sans-serif';
    g.fillText('MYITKYINA', 256, 122);
  });
}

function myanmarFlagTexture() {
  return canvasTex(192, 128, (g) => {
    g.fillStyle = '#fecb00';
    g.fillRect(0, 0, 192, 43);
    g.fillStyle = '#34b233';
    g.fillRect(0, 43, 192, 43);
    g.fillStyle = '#ea2839';
    g.fillRect(0, 86, 192, 42);
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 52 : 20;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(96 + Math.cos(a) * r, 68 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  });
}

/** Vertical textured panel facing +x (local) at u, spanning v0..v1, y0..y1. */
function panel(tex: THREE.Texture, repeatX: number, repeatY: number, u: number, v0: number, v1: number, y0: number, y1: number, facing: 1 | -1) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(repeatX, repeatY);
  const geo = new THREE.PlaneGeometry(Math.abs(v1 - v0), y1 - y0);
  geo.rotateY(facing > 0 ? Math.PI / 2 : -Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, envMapIntensity: 0.3 }));
  m.position.set(u, (y0 + y1) / 2, (v0 + v1) / 2);
  m.receiveShadow = true;
  return m;
}

/** End-face panel (facing ±z) spanning u0..u1. */
function endPanel(tex: THREE.Texture, repeatX: number, v: number, u0: number, u1: number, y0: number, y1: number, facing: 1 | -1) {
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(repeatX, 1);
  const geo = new THREE.PlaneGeometry(u1 - u0, y1 - y0);
  if (facing < 0) geo.rotateY(Math.PI);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, envMapIntensity: 0.3 }));
  m.position.set((u0 + u1) / 2, (y0 + y1) / 2, v);
  return m;
}

// ---- Rolling stock -----------------------------------------------------------------
function boxcar(b: Buckets, u: number, v: number) {
  const L = 9.6;
  b.box('under', 2.1, 0.4, L - 0.6, u, RAIL_TOP + 0.55, v);
  for (const dv of [-L * 0.33, L * 0.33]) b.box('under', 1.9, 0.5, 2.2, u, RAIL_TOP + 0.3, v + dv);
  b.box('wagon', 2.75, 2.5, L, u, RAIL_TOP + 2.0, v);
  b.box('wagonRoof', 2.85, 0.16, L + 0.1, u, RAIL_TOP + 3.3, v);
  // sliding door and ribs
  b.box('wagonDark', 2.8, 2.0, 2.4, u, RAIL_TOP + 1.95, v);
  for (let k = -4; k <= 4; k += 2) if (Math.abs(k) > 1) b.box('wagonDark', 2.79, 2.4, 0.1, u, RAIL_TOP + 2.0, v + k);
}

function coach(b: Buckets, u: number, v: number) {
  const L = 16;
  b.box('under', 2.2, 0.45, L - 1, u, RAIL_TOP + 0.6, v);
  for (const dv of [-L * 0.36, L * 0.36]) b.box('under', 2.0, 0.55, 2.6, u, RAIL_TOP + 0.3, v + dv);
  b.box('coachCream', 2.8, 2.9, L, u, RAIL_TOP + 2.25, v);
  b.box('coachMaroon', 2.84, 0.55, L + 0.02, u, RAIL_TOP + 1.25, v);
  b.box('coachMaroon', 2.84, 0.14, L + 0.02, u, RAIL_TOP + 3.4, v);
  b.box('wagonRoof', 2.6, 0.3, L - 0.2, u, RAIL_TOP + 3.8, v);
  for (let k = -6.4; k <= 6.41; k += 1.6) b.box('glass', 2.86, 0.85, 1.0, u, RAIL_TOP + 2.45, v + k);
  // doors at both ends
  for (const dv of [-L / 2 + 0.8, L / 2 - 0.8]) b.box('coachMaroon', 2.86, 2.1, 0.9, u, RAIL_TOP + 2.1, v + dv);
}

/** DF-class diesel: blue hood, red cab facing -v. */
function locomotive(b: Buckets, u: number, v: number) {
  const L = 14;
  b.box('under', 2.3, 0.6, L, u, RAIL_TOP + 0.7, v);
  for (const dv of [-4.6, 4.6]) b.box('under', 2.1, 0.7, 3.2, u, RAIL_TOP + 0.35, v + dv);
  b.box('locoBlue', 2.3, 2.6, L - 4, u, RAIL_TOP + 2.3, v + 1.8);
  b.box('white', 2.34, 0.18, L - 4, u, RAIL_TOP + 2.0, v + 1.8);
  b.box('locoRed', 2.85, 3.3, 3.6, u, RAIL_TOP + 2.65, v - L / 2 + 2.4);
  b.box('glass', 2.9, 1.0, 2.4, u, RAIL_TOP + 3.4, v - L / 2 + 2.3);
  b.box('glass', 2.2, 1.0, 0.1, u, RAIL_TOP + 3.4, v - L / 2 + 0.55);
  b.box('locoRed', 2.6, 1.1, 0.6, u, RAIL_TOP + 1.5, v - L / 2 + 0.4); // nose
  b.box('wagonRoof', 2.9, 0.2, 3.8, u, RAIL_TOP + 4.4, v - L / 2 + 2.4);
  b.box('yellow', 2.62, 0.2, 0.62, u, RAIL_TOP + 1.0, v - L / 2 + 0.4);
}

function pickup(b: Buckets, u: number, v: number, kind: number) {
  // facing -u (toward the station)
  b.box('under', 4.2, 0.5, 1.7, u, 0.65, v);
  for (const du of [-1.3, 1.3]) for (const dv of [-0.8, 0.8]) b.box('tyre', 0.7, 0.7, 0.25, u + du, 0.35, v + dv);
  if (kind === 2) {
    b.box('vanWhite', 4.4, 1.5, 1.75, u, 1.55, v);
    b.box('glass', 0.1, 0.6, 1.5, u - 2.21, 1.85, v);
    b.box('glass', 3.2, 0.5, 1.77, u + 0.3, 1.9, v);
    return;
  }
  b.box(kind === 1 ? 'locoRed' : 'vanWhite', 1.4, 1.3, 1.7, u - 1.4, 1.45, v);
  b.box('glass', 0.08, 0.55, 1.5, u - 2.12, 1.7, v);
  b.box('truckRed', 2.7, 0.5, 1.75, u + 0.75, 1.15, v);
  b.box('truckGreen', 2.7, 0.12, 1.85, u + 0.75, 2.45, v);
  for (const du of [-0.55, 2.05]) for (const dv of [-0.85, 0.85]) b.box('steel', 0.06, 1.1, 0.06, u + du, 1.9, v + dv);
}

export function createRailwayStation(groundY: number): {
  group: THREE.Group;
  colliders: { x: number; z: number; r: number }[];
} {
  const root = new THREE.Group();
  root.position.set(STATION.x, groundY, STATION.z);
  root.rotation.y = STATION.th;
  const b = new Buckets();

  // ---- Main building ----
  b.box('cream', BLD.u1 - BLD.u0, BLD.h, BLD.v1 - BLD.v0, 0, BLD.h / 2, 0);
  // Low rusty zinc roofs behind the parapet (they read as red-brown on the satellite)
  for (const s of [-1, 1]) b.box('rust', 7.6, 0.12, 62.4, s * 3.8, 8.85, 0, -s * 0.11);
  // Cantilevered floor slab and roof cornice along both long sides
  for (const s of [-1, 1]) {
    b.box('trim', 1.3, 0.28, 64.4, s * (BLD.u1 + 0.6), 4.15, 0);
    b.box('trim', 0.5, 0.35, 64.4, s * (BLD.u1 + 0.2), BLD.h - 0.15, 0);
  }
  // Grey pilasters between the window groups (street side)
  for (const v of [-26, -19, -12.5, 12.5, 19, 26]) b.box('pilaster', 0.7, BLD.h, 0.7, BLD.u1 + 0.3, BLD.h / 2, v);
  // End wings: slightly forward and taller, lattice screens on the front
  for (const s of [-1, 1]) {
    b.box('cream', 17.4, 9.4, 6, 0.7, 4.7, s * 29);
    b.box('pilaster', 0.8, 9.4, 0.8, 9.4, 4.7, s * 26.1);
  }
  // Center tower, three storeys, stepping forward over the entrance
  b.box('cream', 12.6, 12.8, 14, 3.3, 6.4, 0);
  b.box('trim', 13.2, 0.4, 14.6, 3.3, 12.8, 0);
  for (const v of [-7.2, 7.2]) b.box('pilaster', 0.9, 12.8, 0.6, 9.65, 6.4, v);
  // Entrance porch: slab on two columns
  b.box('trim', 3.2, 0.3, 11, 11, 4.0, 0);
  for (const v of [-4.8, 4.8]) b.cyl('colWhite', 0.22, 3.9, 12.3, 1.95, v);
  // Steps
  b.box('platform', 2.2, 0.3, 9, 10.4, 0.15, 0);
  // Flagpole on the tower
  b.cyl('steel', 0.07, 6, 6.5, 12.8 + 3, 0, 8);

  // ---- Platform 1 and its steel canopy (dark strip west of the building) ----
  b.box('platform', PLATFORM_1.u1 - PLATFORM_1.u0, PLATFORM_H, PLATFORM_1.v1 - PLATFORM_1.v0, (PLATFORM_1.u0 + PLATFORM_1.u1) / 2, PLATFORM_H / 2, (PLATFORM_1.v0 + PLATFORM_1.v1) / 2);
  b.box('yellow', 0.3, 0.02, PLATFORM_1.v1 - PLATFORM_1.v0, PLATFORM_1.u0 + 0.6, PLATFORM_H + 0.01, (PLATFORM_1.v0 + PLATFORM_1.v1) / 2);
  const canopyV0 = -40;
  const canopyV1 = 60;
  for (let v = canopyV0 + 2; v <= canopyV1 - 2; v += 7.5) {
    b.cyl('colWhite', 0.2, 4.6, -13.4, PLATFORM_H + 2.3, v);
    b.cyl('colGreen', 0.25, 1.2, -13.4, PLATFORM_H + 0.6, v);
    // truss: top chord, bottom chord and a few diagonals across the platform
    b.box('steel', 10.8, 0.14, 0.14, -13.3, PLATFORM_H + 5.15, v, 0.047);
    b.box('steel', 10.8, 0.12, 0.12, -13.3, PLATFORM_H + 4.55, v);
    for (const du of [-4, -1.5, 1.5, 4]) b.box('steel', 0.08, 0.75, 0.08, -13.3 + du, PLATFORM_H + 4.85, v, du > 0 ? 0.6 : -0.6);
  }
  b.box('canopyRoof', 11.2, 0.1, canopyV1 - canopyV0, -13.3, PLATFORM_H + 5.3, (canopyV0 + canopyV1) / 2, 0.047);
  for (const du of [-4.5, 0, 4.5]) b.box('steel', 0.12, 0.2, canopyV1 - canopyV0, -13.3 + du, PLATFORM_H + 5.1 + du * 0.047, (canopyV0 + canopyV1) / 2);
  // Benches
  for (let v = -30; v <= 50; v += 10) {
    b.box('bench', 0.5, 0.08, 2.2, -11, PLATFORM_H + 0.45, v);
    b.box('bench', 0.08, 0.5, 2.2, -10.75, PLATFORM_H + 0.7, v);
    b.box('steel', 0.5, 0.45, 0.08, -11, PLATFORM_H + 0.22, v - 1);
    b.box('steel', 0.5, 0.45, 0.08, -11, PLATFORM_H + 0.22, v + 1);
  }
  // Station name board on two posts (as in the visitor photo)
  for (const dv of [-1.6, 1.6]) b.cyl('steel', 0.06, 2.6, -15.5, PLATFORM_H + 1.3, 48 + dv, 8);

  // ---- Island platform with a long low shed ----
  b.box('platform', ISLAND.u1 - ISLAND.u0, PLATFORM_H, ISLAND.v1 - ISLAND.v0, (ISLAND.u0 + ISLAND.u1) / 2, PLATFORM_H / 2, (ISLAND.v0 + ISLAND.v1) / 2);
  for (const u of [ISLAND.u0 + 0.6, ISLAND.u1 - 0.6]) b.box('yellow', 0.3, 0.02, ISLAND.v1 - ISLAND.v0, u, PLATFORM_H + 0.01, (ISLAND.v0 + ISLAND.v1) / 2);
  const shedU = (ISLAND.u0 + ISLAND.u1) / 2;
  for (let v = ISLAND.v0 + 6; v <= ISLAND.v1 - 6; v += 8) {
    b.box('steel', 0.22, 3.8, 0.22, shedU, PLATFORM_H + 1.9, v);
    b.box('steel', 9.6, 0.16, 0.16, shedU, PLATFORM_H + 3.75, v);
  }
  for (const s of [-1, 1]) b.box('shedRoof', 5.4, 0.1, ISLAND.v1 - ISLAND.v0 - 6, shedU + s * 2.6, PLATFORM_H + 3.95, (ISLAND.v0 + ISLAND.v1) / 2, -s * 0.17);

  // ---- Ballast and rails ----
  b.box('ballast', BALLAST.u1 - BALLAST.u0, 0.3, BALLAST.v1 - BALLAST.v0, (BALLAST.u0 + BALLAST.u1) / 2, 0.15, (BALLAST.v0 + BALLAST.v1) / 2);
  let sleeperCount = 0;
  for (const t of TRACKS) {
    const len = t.v1 - t.v0;
    for (const s of [-0.5, 0.5]) b.box('rail', 0.07, 0.15, len, t.u + s, 0.44 + 0.075, (t.v0 + t.v1) / 2);
    sleeperCount += Math.floor(len / 0.65);
    // Buffer stop at the north end of the line
    b.box('locoRed', 2.0, 0.5, 0.4, t.u, 1.0, t.v0 + 0.4);
    b.box('white', 2.0, 0.18, 0.42, t.u, 1.0, t.v0 + 0.4);
    for (const s of [-0.6, 0.6]) b.box('steel', 0.18, 0.8, 1.4, t.u + s, 0.7, t.v0 + 1.0, 0, 0);
  }

  // ---- Trains ----
  // Passenger train at platform 1: locomotive at the north end, four coaches
  locomotive(b, TRACKS[0].u, -30);
  for (let k = 0; k < 4; k++) coach(b, TRACKS[0].u, -14.5 + k * 16.4);
  // Boxcars beside the island platform and on the middle road
  for (let k = 0; k < 5; k++) boxcar(b, TRACKS[3].u, 30 + k * 10.1);
  for (let k = 0; k < 3; k++) boxcar(b, TRACKS[2].u, 92 + k * 10.1);
  for (let k = 0; k < 2; k++) boxcar(b, TRACKS[4].u, 60 + k * 10.1);

  // ---- Forecourt ----
  b.box('forecourt', FENCE_U - BLD.u1 + 1.5, 0.06, 70, (BLD.u1 + FENCE_U + 1.5) / 2, 0.03, 0);
  // Fence on a red-and-white curb along the street, with two driveway gaps
  const fenceRuns: [number, number][] = [];
  let start = -35;
  for (const [g0, g1] of FENCE_GAPS) {
    fenceRuns.push([start, g0]);
    start = g1;
  }
  fenceRuns.push([start, 35]);
  for (const [v0, v1] of fenceRuns) {
    const len = v1 - v0;
    for (let k = 0; k < Math.round(len); k++) {
      b.box(k % 2 === 0 ? 'curbRed' : 'white', 0.35, 0.35, 1.0, FENCE_U + 0.5, 0.175, v0 + k + 0.5);
    }
    for (const y of [0.7, 1.15]) b.box('steel', 0.06, 0.06, len, FENCE_U, y, (v0 + v1) / 2);
    for (let v = v0; v <= v1 + 0.01; v += 2.5) b.box('steel', 0.1, 1.2, 0.1, FENCE_U, 0.6, v);
  }
  // Light trucks with green canopies and white vans parked facing the building
  const parked: [number, number, number][] = [
    [27, -15, 0], [27, -10.5, 1], [27, -6, 0], [27, 6, 2], [27, 10.5, 0], [27, 15, 2],
    [33, -12, 2], [33, 12, 1],
  ];
  for (const [u, v, k] of parked) pickup(b, u, v, k);

  // ---- Materials and merge ----
  const concrete = concreteDetailTexture();
  const gravel = gravelTexture();
  const mats: Record<string, THREE.Material> = {
    cream: new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.88, envMapIntensity: 0.3 }),
    trim: new THREE.MeshStandardMaterial({ color: '#d3ccbc', roughness: 0.85, envMapIntensity: 0.3 }),
    pilaster: new THREE.MeshStandardMaterial({ color: '#b7b2a6', roughness: 0.85, envMapIntensity: 0.3 }),
    rust: new THREE.MeshStandardMaterial({ color: '#8a4b31', roughness: 0.75, metalness: 0.2, envMapIntensity: 0.3 }),
    platform: new THREE.MeshStandardMaterial({ color: '#bdb8ac', map: concrete, roughness: 0.95, envMapIntensity: 0.25 }),
    forecourt: new THREE.MeshStandardMaterial({ color: '#a9a49a', map: concrete, roughness: 0.97, envMapIntensity: 0.2 }),
    ballast: new THREE.MeshStandardMaterial({ color: '#ffffff', map: gravel, roughness: 1, envMapIntensity: 0.2 }),
    rail: new THREE.MeshStandardMaterial({ color: '#7c7670', roughness: 0.4, metalness: 0.7, envMapIntensity: 0.6 }),
    steel: new THREE.MeshStandardMaterial({ color: '#7f868b', roughness: 0.55, metalness: 0.5, envMapIntensity: 0.4 }),
    canopyRoof: new THREE.MeshStandardMaterial({ color: '#5d6468', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.3 }),
    shedRoof: new THREE.MeshStandardMaterial({ color: '#6f7a76', roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide, envMapIntensity: 0.3 }),
    colWhite: new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.8, envMapIntensity: 0.3 }),
    colGreen: new THREE.MeshStandardMaterial({ color: '#2f7d4a', roughness: 0.7, envMapIntensity: 0.3 }),
    bench: new THREE.MeshStandardMaterial({ color: '#2c6e8f', roughness: 0.6, envMapIntensity: 0.3 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#e5c23a', roughness: 0.7, envMapIntensity: 0.3 }),
    white: new THREE.MeshStandardMaterial({ color: '#f3f3f0', roughness: 0.7, envMapIntensity: 0.3 }),
    curbRed: new THREE.MeshStandardMaterial({ color: '#b52222', roughness: 0.7, envMapIntensity: 0.3 }),
    under: new THREE.MeshStandardMaterial({ color: '#25211e', roughness: 0.8, metalness: 0.3, envMapIntensity: 0.2 }),
    tyre: new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.9, envMapIntensity: 0.1 }),
    wagon: new THREE.MeshStandardMaterial({ color: '#7d3523', roughness: 0.8, metalness: 0.15, envMapIntensity: 0.3 }),
    wagonDark: new THREE.MeshStandardMaterial({ color: '#652a1c', roughness: 0.8, metalness: 0.15, envMapIntensity: 0.3 }),
    wagonRoof: new THREE.MeshStandardMaterial({ color: '#6c625a', roughness: 0.75, metalness: 0.2, envMapIntensity: 0.3 }),
    coachCream: new THREE.MeshStandardMaterial({ color: '#e6dec4', roughness: 0.65, envMapIntensity: 0.35 }),
    coachMaroon: new THREE.MeshStandardMaterial({ color: '#702822', roughness: 0.65, envMapIntensity: 0.35 }),
    glass: new THREE.MeshStandardMaterial({ color: '#27323a', roughness: 0.25, metalness: 0.4, envMapIntensity: 0.8 }),
    locoBlue: new THREE.MeshStandardMaterial({ color: '#23479b', roughness: 0.55, metalness: 0.2, envMapIntensity: 0.4 }),
    locoRed: new THREE.MeshStandardMaterial({ color: '#c3382a', roughness: 0.55, metalness: 0.2, envMapIntensity: 0.4 }),
    vanWhite: new THREE.MeshStandardMaterial({ color: '#eceff1', roughness: 0.45, metalness: 0.2, envMapIntensity: 0.5 }),
    truckRed: new THREE.MeshStandardMaterial({ color: '#b42c22', roughness: 0.6, envMapIntensity: 0.3 }),
    truckGreen: new THREE.MeshStandardMaterial({ color: '#3d8a3c', roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.3 }),
  };
  const planar: Record<string, number> = { platform: 2.5, forecourt: 3, ballast: 2 };
  for (const [key, geos] of b.map) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    if (planar[key]) planarUV(merged, planar[key]);
    const mesh = new THREE.Mesh(merged, mats[key] ?? mats.cream);
    const flat = key === 'ballast' || key === 'forecourt' || key === 'platform' || key === 'yellow';
    mesh.castShadow = !flat;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  // Sleepers: one instanced mesh
  const sleeperGeo = new THREE.BoxGeometry(1.9, 0.14, 0.24);
  const sleepers = new THREE.InstancedMesh(
    sleeperGeo,
    new THREE.MeshStandardMaterial({ color: '#5f5a54', roughness: 0.9, envMapIntensity: 0.2 }),
    sleeperCount,
  );
  const dummy = new THREE.Object3D();
  let n = 0;
  for (const t of TRACKS) {
    for (let v = t.v0 + 0.3; v < t.v1 && n < sleeperCount; v += 0.65) {
      dummy.position.set(t.u, 0.37, v);
      dummy.updateMatrix();
      sleepers.setMatrixAt(n++, dummy.matrix);
    }
  }
  sleepers.count = n;
  sleepers.receiveShadow = true;
  root.add(sleepers);

  // ---- Textured facades ----
  const bay = facadeBayTexture();
  const tower = towerBayTexture();
  const lattice = latticeTexture();
  // Street side: window bands either side of the tower; platform side: full length
  root.add(panel(bay, 5, 1, BLD.u1 + 0.02, -26, -7.3, 0, 8.4, 1));
  root.add(panel(bay, 5, 1, BLD.u1 + 0.02, 7.3, 26, 0, 8.4, 1));
  root.add(panel(bay, 14, 1, BLD.u0 - 0.02, -26, 26, 0, 8.4, -1));
  root.add(panel(tower, 4, 1, 9.62, -7, 7, 0, 12.4, 1));
  for (const s of [-1, 1]) {
    // lattice screens on the wing fronts, windows on the wing ends
    root.add(panel(lattice, 5, 8, 9.42, s * 29 - 2.6, s * 29 + 2.6, 0.8, 8.8, 1));
    root.add(endPanel(bay, 4, s * 32.02, -8, 9.4, 0, 8.4, s as 1 | -1));
    root.add(panel(bay, 2, 1, -8.02, s * 29 - 3, s * 29 + 3, 0, 8.4, -1));
  }
  // Station sign high on the tower front
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.5), new THREE.MeshBasicMaterial({ map: stationSignTexture() }));
  sign.geometry.rotateY(Math.PI / 2);
  sign.position.set(9.68, 11.55, 0);
  root.add(sign);
  // Platform name board
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 3.6), [
    new THREE.MeshStandardMaterial({ map: platformNameTexture(), roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: platformNameTexture(), roughness: 0.6 }),
    mats.steel,
    mats.steel,
    mats.steel,
    mats.steel,
  ]);
  board.position.set(-15.5, PLATFORM_H + 2.3, 48);
  root.add(board);
  // Myanmar flag
  const flagTex = myanmarFlagTexture();
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.geometry.rotateY(Math.PI / 2);
  flag.position.set(6.5, 12.8 + 5.1, 1.25);
  root.add(flag);

  // ---- Colliders (world space) ----
  const colliders: { x: number; z: number; r: number }[] = [];
  const pushLocal = (u: number, v: number, r: number) => {
    const w = stationWorld(u, v);
    colliders.push({ x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10, r });
  };
  for (let v = -28; v <= 28; v += 4) pushLocal(0, v, 8);
  pushLocal(5, 0, 6.5); // tower front
  const trainLine = (u: number, v0: number, v1: number) => {
    for (let v = v0; v <= v1; v += 2.6) pushLocal(u, v, 1.5);
  };
  trainLine(TRACKS[0].u, -37, 50);
  trainLine(TRACKS[3].u, 25, 80);
  trainLine(TRACKS[2].u, 87, 112);
  trainLine(TRACKS[4].u, 55, 70);

  return { group: root, colliders };
}

/**
 * New game: the traveller has just come out of the station into the forecourt and turns to
 * look back at it (under the platform canopy the chase camera would sit above the roof).
 */
export const STATION_ARRIVAL = (() => {
  const p = stationWorld(21, -2);
  return { x: p.x, z: p.z, heading: -Math.PI / 2 + STATION.th };
})();

/** An e-bike waiting in the forecourt, pointing at the street, so the ride into town can start here. */
export const STATION_EBIKE = (() => {
  const p = stationWorld(30, -24.5);
  return { x: p.x, z: p.z, heading: Math.PI / 2 + STATION.th };
})();

/** The Kachin Sky EV, parked in the forecourt by the south driveway. */
export const STATION_SKYEV = (() => {
  const p = stationWorld(33, 21);
  return { x: p.x, z: p.z, heading: -Math.PI / 2 + STATION.th };
})();
