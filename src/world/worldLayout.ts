/**
 * Placement helpers for the 1:1 Myitkyina play area.
 * Everything here works from the generated OSM data, so game objects land on
 * real streets and empty plots instead of hand-typed coordinates.
 *
 * Must not import values from ../types/game (that module imports this one).
 */
import { OPEN_LOTS, OSM_ROAD_SEGMENTS, WORLD_BOUNDS } from './mapData.generated';

export interface StreetPoint {
  x: number;
  z: number;
  /** Heading along the street (radians, atan2(dx, dz)) */
  heading: number;
  segIndex: number;
}

const DRIVABLE_MAIN = new Set(['asphalt', 'concrete']);

/** Nearest point on a street centerline. `mainOnly` skips dirt lanes and service roads. */
export function nearestStreetPoint(x: number, z: number, mainOnly = false): StreetPoint {
  let best: StreetPoint = { x, z, heading: 0, segIndex: -1 };
  let bestD = Infinity;
  for (let i = 0; i < OSM_ROAD_SEGMENTS.length; i++) {
    const s = OSM_ROAD_SEGMENTS[i];
    if (mainOnly && !DRIVABLE_MAIN.has(s.surface)) continue;
    const vx = s.x2 - s.x1;
    const vz = s.z2 - s.z1;
    const L = vx * vx + vz * vz;
    const t = L > 0 ? Math.max(0, Math.min(1, ((x - s.x1) * vx + (z - s.z1) * vz) / L)) : 0;
    const px = s.x1 + vx * t;
    const pz = s.z1 + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestD) {
      bestD = d;
      best = { x: px, z: pz, heading: Math.atan2(vx, vz), segIndex: i };
    }
  }
  return best;
}

/** A point beside the nearest street (offset meters to the street's right side). */
export function roadsidePoint(x: number, z: number, offset = 5, mainOnly = false) {
  const p = nearestStreetPoint(x, z, mainOnly);
  const seg = OSM_ROAD_SEGMENTS[p.segIndex];
  const off = offset + (seg ? seg.width / 2 : 0);
  // Right-hand normal of heading (dx, dz) = (sin h, cos h) is (cos h, -sin h)
  let rx = p.x + Math.cos(p.heading) * off;
  let rz = p.z - Math.sin(p.heading) * off;
  // Prefer the side the caller asked from
  const lx = p.x - Math.cos(p.heading) * off;
  const lz = p.z + Math.sin(p.heading) * off;
  if (Math.hypot(lx - x, lz - z) < Math.hypot(rx - x, rz - z)) {
    rx = lx;
    rz = lz;
  }
  return { x: Math.round(rx * 10) / 10, z: Math.round(rz * 10) / 10, heading: p.heading };
}

const usedLots = new Set<number>();

/**
 * Reserve the nearest free open lot that can hold a footprint of the given size.
 * Returns its center and the heading to face the closest street.
 */
export function reserveLot(nearX: number, nearZ: number, width: number, depth: number) {
  const need = Math.hypot(width, depth) / 2 + 2;
  let bestI = -1;
  let bestD = Infinity;
  for (let i = 0; i < OPEN_LOTS.length; i++) {
    if (usedLots.has(i)) continue;
    const l = OPEN_LOTS[i];
    if (l.r < need) continue;
    const d = Math.hypot(l.x - nearX, l.z - nearZ);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  if (bestI < 0) return { x: nearX, z: nearZ, faceHeading: 0 };
  usedLots.add(bestI);
  // Lots overlapping this one cannot be reused either
  const chosen = OPEN_LOTS[bestI];
  for (let i = 0; i < OPEN_LOTS.length; i++) {
    const l = OPEN_LOTS[i];
    if (Math.hypot(l.x - chosen.x, l.z - chosen.z) < l.r + need) usedLots.add(i);
  }
  const street = nearestStreetPoint(chosen.x, chosen.z);
  return {
    x: chosen.x,
    z: chosen.z,
    faceHeading: Math.atan2(street.x - chosen.x, street.z - chosen.z),
  };
}

export function clampToWorld(x: number, z: number, margin = 30) {
  return {
    x: Math.max(WORLD_BOUNDS.minX + margin, Math.min(WORLD_BOUNDS.maxX - margin, x)),
    z: Math.max(WORLD_BOUNDS.minZ + margin, Math.min(WORLD_BOUNDS.maxZ - margin, z)),
  };
}

/**
 * Old hand-placed content was laid out on a ~±500 m fictional grid around the plaza.
 * Spread it over the real town and drop it onto the nearest street.
 */
export const LEGACY_SPREAD = 2.6;
export function relocateLegacy(x: number, z: number, mainOnly = true) {
  const c = clampToWorld(x * LEGACY_SPREAD, z * LEGACY_SPREAD, 80);
  const p = nearestStreetPoint(c.x, c.z, mainOnly);
  return { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, heading: p.heading };
}
