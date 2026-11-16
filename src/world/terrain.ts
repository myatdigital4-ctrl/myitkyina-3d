import * as THREE from 'three';
import { MYITKYINA_ROAD_SEGMENTS, RoadSurfaceType } from '../types/game';
import { RIVER_POINTS, WORLD_BOUNDS } from './mapData.generated';

// ============================================================================
// 1:1 MYITKYINA TERRAIN & AYEYARWADY RIVER (world meters, origin = Manau plaza)
// River line comes from scripts/build-map-data.mjs (estimated from where the real
// streets stop on each bank). The play area is flat alluvial plain; low hills rise
// just outside WORLD_BOUNDS to close the edges.
// ============================================================================
function riverSample(z: number): { cx: number; hw: number } {
  const pts = RIVER_POINTS;
  if (z <= pts[0].z) return pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (z <= b.z) {
      // Smoothstep between control points avoids sharp kinks in the banks
      const t = THREE.MathUtils.smoothstep(z, a.z, b.z);
      return { cx: a.cx + (b.cx - a.cx) * t, hw: a.hw + (b.hw - a.hw) * t };
    }
  }
  return pts[pts.length - 1];
}

export function riverCenterX(z: number): number {
  return riverSample(z).cx + Math.sin(z * 0.006) * 12;
}

export function riverHalfWidth(z: number): number {
  return riverSample(z).hw + Math.sin(z * 0.004 + 1.3) * 10;
}

export function waterSignedDistance(x: number, z: number): number {
  return Math.abs(x - riverCenterX(z)) - riverHalfWidth(z);
}

// Balaminhtin Bridge is ~5 km north of the play area, so there is no bridge deck here.
export const BRIDGE_Z = -100000;

export function isBridgeDeck(_x: number, _z: number): boolean {
  return false;
}

export function bridgeDeckHeightAt(_x: number): number {
  return 0;
}

export function distToSegment(
  px: number,
  pz: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
): number {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const wx = px - x1;
  const wz = pz - z1;
  const c1 = wx * vx + wz * vz;
  if (c1 <= 0) return Math.hypot(px - x1, pz - z1);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - x2, pz - z2);
  const b = c1 / c2;
  const bx = x1 + b * vx;
  const bz = z1 + b * vz;
  return Math.hypot(px - bx, pz - bz);
}

export function groundHeightAt(x: number, z: number): number {
  const waterDist = waterSignedDistance(x, z);

  if (waterDist < 14) {
    const bankT = THREE.MathUtils.smoothstep(waterDist, -40, 14);
    return THREE.MathUtils.lerp(-4.5, 0.8, bankT);
  }

  // Distance outside the playable square (0 inside)
  const outX = Math.max(WORLD_BOUNDS.minX - x, 0, x - WORLD_BOUNDS.maxX);
  const outZ = Math.max(WORLD_BOUNDS.minZ - z, 0, z - WORLD_BOUNDS.maxZ);
  const outside = Math.hypot(outX, outZ);
  const edgeHills =
    outside > 0
      ? Math.min(1, outside / 260) ** 1.4 *
        (34 + Math.sin(x * 0.011) * 9 + Math.cos(z * 0.013) * 8) *
        THREE.MathUtils.smoothstep(waterDist, 14, 120)
      : 0;

  return 0.8 + edgeHills;
}

export function playableSurfaceHeightAt(x: number, z: number): number {
  const g = groundHeightAt(x, z);
  if (isBridgeDeck(x, z)) {
    return Math.max(g, bridgeDeckHeightAt(x));
  }
  return g;
}

// ============================================================================
// MULTI-SURFACE SITAPU ROAD SDF (ASPHALT, CONCRETE, RED LATERITE DIRT, SAND)
// ============================================================================
const SURFACE_PRIORITY: Record<RoadSurfaceType, number> = {
  asphalt: 4,
  concrete: 3,
  laterite_dirt: 2,
  riverside_sand: 1,
};

// Spatial hash of road segments (built on first use) so lookups only test nearby streets
const ROAD_CELL = 40;
const EMPTY: number[] = [];
const gridKey = (cx: number, cz: number) => cx * 100003 + cz;
let roadGridCache: Map<number, number[]> | null = null;
function roadGrid(): Map<number, number[]> {
  if (roadGridCache) return roadGridCache;
  const grid = new Map<number, number[]>();
  MYITKYINA_ROAD_SEGMENTS.forEach((seg, i) => {
    const pad = seg.width * 0.5 + 4;
    const x0 = Math.floor((Math.min(seg.x1, seg.x2) - pad) / ROAD_CELL);
    const x1 = Math.floor((Math.max(seg.x1, seg.x2) + pad) / ROAD_CELL);
    const z0 = Math.floor((Math.min(seg.z1, seg.z2) - pad) / ROAD_CELL);
    const z1 = Math.floor((Math.max(seg.z1, seg.z2) + pad) / ROAD_CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = gridKey(cx, cz);
        const list = grid.get(k);
        if (list) list.push(i);
        else grid.set(k, [i]);
      }
    }
  });
  roadGridCache = grid;
  return grid;
}

export function roadSurfaceAt(
  x: number,
  z: number,
): { weight: number; surface: RoadSurfaceType } {
  let bestWeight = 0;
  let bestSurface: RoadSurfaceType = 'laterite_dirt';
  let bestPriority = 0;

  const cell = roadGrid().get(gridKey(Math.floor(x / ROAD_CELL), Math.floor(z / ROAD_CELL)));
  const candidates = cell || EMPTY;
  for (let c = 0; c < candidates.length; c++) {
    const seg = MYITKYINA_ROAD_SEGMENTS[candidates[c]];
    const d = distToSegment(x, z, seg.x1, seg.z1, seg.x2, seg.z2);
    const halfW = seg.width * 0.5;
    const feather = seg.surface === 'laterite_dirt' || seg.surface === 'riverside_sand' ? 3.6 : 2.6;
    if (d < halfW + feather) {
      const w = 1 - THREE.MathUtils.smoothstep(d, halfW * 0.85, halfW + feather);
      const prio = SURFACE_PRIORITY[seg.surface];
      if (w > bestWeight + 0.08 || (Math.abs(w - bestWeight) <= 0.08 && prio > bestPriority)) {
        bestWeight = w;
        bestSurface = seg.surface;
        bestPriority = prio;
      }
    }
  }

  // Sitapu Manau Park Circular Ceremonial Ground at (0, 0)
  const dManauPlaza = Math.hypot(x, z);
  const wManauPlaza = 1 - THREE.MathUtils.smoothstep(dManauPlaza, 47, 53);
  if (wManauPlaza > bestWeight) {
    bestWeight = wManauPlaza;
    bestSurface = 'concrete';
  }

  return { weight: bestWeight, surface: bestSurface };
}

export function roadWeightAt(x: number, z: number): number {
  return roadSurfaceAt(x, z).weight;
}

// High-Contrast Burmese + English 3D Building/Shop Signboard Texture
export function createSignboardTexture(
  renderer: THREE.WebGLRenderer,
  titleMm: string,
  titleEn: string,
  bgColor: string,
  accentColor: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#091016';
  ctx.fillRect(0, 0, 512, 160);

  ctx.fillStyle = bgColor;
  ctx.fillRect(8, 8, 496, 144);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, 488, 136);

  // Burmese Sign Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(titleMm, 256, 60, 460);

  // English Subtitle
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 24px "Outfit", sans-serif';
  ctx.fillText(titleEn.toUpperCase(), 256, 114, 460);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

export function createManauTotemTexture(
  renderer: THREE.WebGLRenderer,
  variant: number = 0,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const bgColors = ['#b91c1c', '#0f172a', '#991b1b', '#1e293b'];
  ctx.fillStyle = bgColors[variant % bgColors.length];
  ctx.fillRect(0, 0, 256, 512);

  const stripeColors = ['#facc15', '#f8fafc', '#10b981', '#ef4444'];
  ctx.lineWidth = 6;

  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, y, 256, 6);

    for (let x = 0; x < 256; x += 64) {
      const cx = x + 32;
      const cy = y + 35;

      ctx.fillStyle = stripeColors[(variant + x / 64 + y / 64) % stripeColors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy - 24);
      ctx.lineTo(cx + 26, cy);
      ctx.lineTo(cx, cy + 24);
      ctx.lineTo(cx - 26, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx + 13, cy);
      ctx.lineTo(cx, cy + 12);
      ctx.lineTo(cx - 13, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

export function createKachinWeaveTexture(
  renderer: THREE.WebGLRenderer,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#991b1b';
  ctx.fillRect(0, 0, 128, 128);

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 20, 128, 24);
  ctx.fillRect(0, 84, 128, 24);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 64);
    ctx.lineTo(x + 16, 48);
    ctx.lineTo(x + 32, 64);
    ctx.lineTo(x + 16, 80);
    ctx.closePath();
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Painted emblems seen on Manau poles: sun, moon, star and hornbill
export function createManauMotifTexture(
  renderer: THREE.WebGLRenderer,
  motif: 'sun' | 'moon' | 'star' | 'hornbill',
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 256, 256);
  // Round white plate with red rim
  g.fillStyle = '#fef3c7';
  g.beginPath();
  g.arc(128, 128, 120, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 12;
  g.strokeStyle = '#991b1b';
  g.stroke();

  if (motif === 'sun') {
    g.fillStyle = '#f59e0b';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(128 + Math.cos(a - 0.12) * 48, 128 + Math.sin(a - 0.12) * 48);
      g.lineTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
      g.lineTo(128 + Math.cos(a + 0.12) * 48, 128 + Math.sin(a + 0.12) * 48);
      g.fill();
    }
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.arc(128, 128, 44, 0, Math.PI * 2);
    g.fill();
  } else if (motif === 'moon') {
    g.fillStyle = '#1e3a8a';
    g.beginPath();
    g.arc(128, 128, 78, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fef3c7';
    g.beginPath();
    g.arc(158, 112, 66, 0, Math.PI * 2);
    g.fill();
  } else if (motif === 'star') {
    g.fillStyle = '#15803d';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? 92 : 38;
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      const x = 128 + Math.cos(a) * r;
      const y = 128 + Math.sin(a) * r;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  } else {
    // Hornbill in profile: body, tail, big curved bill with casque
    g.fillStyle = '#111827';
    g.beginPath();
    g.ellipse(118, 140, 52, 34, -0.2, 0, Math.PI * 2); // body
    g.fill();
    g.beginPath();
    g.moveTo(70, 150);
    g.lineTo(32, 190);
    g.lineTo(58, 196);
    g.lineTo(88, 162);
    g.fill(); // tail
    g.beginPath();
    g.arc(160, 102, 22, 0, Math.PI * 2); // head
    g.fill();
    g.fillStyle = '#f59e0b';
    g.beginPath();
    g.moveTo(176, 96);
    g.quadraticCurveTo(220, 100, 232, 140);
    g.quadraticCurveTo(206, 120, 176, 114);
    g.fill(); // bill
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.moveTo(172, 90);
    g.quadraticCurveTo(206, 72, 222, 104);
    g.quadraticCurveTo(200, 92, 178, 98);
    g.fill(); // casque
    g.fillStyle = '#fef3c7';
    g.beginPath();
    g.arc(164, 98, 4, 0, Math.PI * 2);
    g.fill(); // eye
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// Union of Myanmar flag: yellow / green / red bands with a white star
export function createMyanmarFlagTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 128;
  const g = c.getContext('2d')!;
  const bands = ['#fecb00', '#34b233', '#ea2839'];
  bands.forEach((col, k) => {
    g.fillStyle = col;
    g.fillRect(0, (k * 128) / 3, 192, 128 / 3 + 1);
  });
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 === 0 ? 52 : 20;
    const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
    const x = 96 + Math.cos(a) * r;
    const y = 70 + Math.sin(a) * r;
    if (k === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
