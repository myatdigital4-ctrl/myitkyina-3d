#!/usr/bin/env node
/**
 * Builds the 1:1-scale 3×3 km Myitkyina play area from the OpenStreetMap export.
 *
 *   node scripts/build-map-data.mjs
 *
 * Input:  public/assets/aistudio/export.geojson   (OpenStreetMap: streets, named buildings)
 *         data/microsoft-buildings/*.csv.gz       (Microsoft Global ML Building Footprints, optional)
 * Output: public/assets/map/myitkyina-core.geojson   (features clipped to the play area)
 *         src/world/mapData.generated.ts              (projection, bounds, river, road segments, places)
 *
 * World units are meters. +x = east, +z = south. World origin (0, 0) is the Manau plaza.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'public/assets/aistudio/export.geojson');
const MS_DIR = path.join(ROOT, 'data/microsoft-buildings');
const OUT_GEOJSON = path.join(ROOT, 'public/assets/map/myitkyina-core.geojson');
const OUT_TS = path.join(ROOT, 'src/world/mapData.generated.ts');

// --- Projection (local equirectangular, meters) ----------------------------
// Reference point C: downtown Myitkyina, near the railway station.
const C = { lat: 25.38, lng: 97.394 };
const M_PER_LAT = 110950;
const M_PER_LNG = 111320 * Math.cos((C.lat * Math.PI) / 180);
const toC = (lat, lng) => ({ x: (lng - C.lng) * M_PER_LNG, z: (lat - C.lat) * -M_PER_LAT });

// Play area relative to C (3 km × 3 km): from the railway station (south edge) north to
// the Kachin National Manau Park, with the Ayeyarwady on the east side.
const AREA = { minX: -1200, maxX: 1800, minZ: -2885, maxZ: 115 };

// Ayeyarwady west channel, traced from Google satellite imagery: `west` is the city-side
// bank, `east` where the big sandbar island starts (or open water in the north).
// C-relative meters; z grows southward.
const RIVER_BANKS = [
  { z: -3500, west: 1720, east: 2320 },
  { z: -2884, west: 1688, east: 2288 },
  { z: -2431, west: 1527, east: 2127 },
  { z: -1978, west: 1268, east: 1850 },
  { z: -1720, west: 1171, east: 1559 },
  { z: -1331, west: 1009, east: 1313 },
  { z: -685, west: 925, east: 1268 },
  { z: -38, west: 920, east: 1300 },
  { z: 480, west: 1074, east: 1430 },
  { z: 1500, west: 1150, east: 1500 },
];
const RIVER_C = RIVER_BANKS.map((b) => ({ z: b.z, cx: (b.west + b.east) / 2, hw: (b.east - b.west) / 2 }));
function riverAt(z, pts) {
  if (z <= pts[0].z) return pts[0];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (z <= b.z) {
      const t = (z - a.z) / (b.z - a.z);
      return { cx: a.cx + (b.cx - a.cx) * t, hw: a.hw + (b.hw - a.hw) * t };
    }
  }
  return pts[pts.length - 1];
}
const waterDistC = (x, z) => {
  const r = riverAt(z, RIVER_C);
  return Math.abs(x - r.cx) - r.hw;
};

// --- Load ------------------------------------------------------------------
const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const feats = src.features.filter((f) => f.geometry && f.properties);

const ringOf = (f) =>
  f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates;
const centroidC = (f) => {
  const r = ringOf(f);
  let lat = 0;
  let lng = 0;
  for (const [g, a] of r) {
    lng += g;
    lat += a;
  }
  return toC(lat / r.length, lng / r.length);
};
const inArea = (p, m = 0) =>
  p.x >= AREA.minX - m && p.x <= AREA.maxX + m && p.z >= AREA.minZ - m && p.z <= AREA.maxZ + m;

/** Uniform grid of items by bounding box, for fast "what's near here" queries. */
function makeGrid(cell) {
  const map = new Map();
  const key = (i, j) => i * 100003 + j;
  return {
    add(item, x0, z0, x1, z1) {
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)
        for (let j = Math.floor(z0 / cell); j <= Math.floor(z1 / cell); j++) {
          const k = key(i, j);
          const l = map.get(k);
          if (l) l.push(item);
          else map.set(k, [item]);
        }
    },
    near(x, z, r) {
      const out = new Set();
      for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++)
        for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) {
          const l = map.get(key(i, j));
          if (l) for (const it of l) out.add(it);
        }
      return out;
    },
  };
}

// --- Microsoft building footprints (optional, much denser than OSM here) ---
// One GeoJSON feature per line; heights are not provided (-1) for Myanmar.
const msFeats = [];
if (fs.existsSync(MS_DIR)) {
  for (const file of fs.readdirSync(MS_DIR).filter((f) => f.endsWith('.csv.gz'))) {
    const text = zlib.gunzipSync(fs.readFileSync(path.join(MS_DIR, file))).toString('utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      const f = JSON.parse(line);
      if (!f.geometry || f.geometry.type !== 'Polygon') continue;
      const ring = f.geometry.coordinates[0].map(([g, a]) => [+g.toFixed(7), +a.toFixed(7)]);
      const feat = {
        type: 'Feature',
        properties: { building: 'yes', source: 'microsoft' },
        geometry: { type: 'Polygon', coordinates: [ring] },
      };
      if (inArea(centroidC(feat), 100)) msFeats.push(feat);
    }
  }
}

// --- Manau plaza: center of the real dance circle (Google satellite) ---------
const MANAU_LATLNG = { lat: 25.401888, lng: 97.405819 };
const manau = { ...toC(MANAU_LATLNG.lat, MANAU_LATLNG.lng), minD: 0 };
const ORIGIN = {
  lat: C.lat - manau.z / M_PER_LAT,
  lng: C.lng + manau.x / M_PER_LNG,
};
const toWorld = (lat, lng) => {
  const p = toC(lat, lng);
  return { x: p.x - manau.x, z: p.z - manau.z };
};
const cToWorld = (p) => ({ x: p.x - manau.x, z: p.z - manau.z });

// --- Railway station complex (modeled by hand in src/world/railwayStation.ts) ---
// Local frame: u across the tracks (+ toward Tha Khin Net Hpay St), v along them (+ south).
// Keep in sync with STATION in railwayStation.ts.
const STATION = { x: -716.75, z: 2391.1, th: 0.063 };
function stationLocal(w) {
  const dx = w.x - STATION.x;
  const dz = w.z - STATION.z;
  const c = Math.cos(STATION.th);
  const s = Math.sin(STATION.th);
  return { u: dx * c - dz * s, v: dx * s + dz * c };
}
/** Rail corridor west of the station building, plus the forecourt in front of it */
function inStationYard(w) {
  const { u, v } = stationLocal(w);
  if (u > -58 && u < -9 && v > -135 && v < 160) return true;
  return u > 8 && u < 42 && v > -35 && v < 35;
}
// Sutaungpyae Pagoda compound (modeled by hand in src/world/sutaungpyae.ts); world meters
const PAGODA = { x: -49.2, z: 529.0 };
function inPagodaCompound(w) {
  const dx = w.x - PAGODA.x;
  const dz = w.z - PAGODA.z;
  if (dx > -31 && dx < 33 && dz > -58 && dz < 60) return true; // halls, terrace, courtyard, gate
  return dx > -64 && dx < -26 && dz > 46 && dz < 66; // reclining Buddha shed
}
function pagodaDist(w) {
  const dx = w.x - PAGODA.x;
  const dz = w.z - PAGODA.z;
  return Math.hypot(Math.max(-64 - dx, 0, dx - 33), Math.max(-58 - dz, 0, dz - 66));
}
/** Distance from a point to the whole station complex rectangle (0 inside) */
function stationComplexDist(w) {
  const { u, v } = stationLocal(w);
  const du = Math.max(-58 - u, 0, u - 44);
  const dv = Math.max(-135 - v, 0, v - 160);
  return Math.hypot(du, dv);
}

// --- Clip features ----------------------------------------------------------
const PLAZA_CLEAR = 50; // dance circle + ring road (radius ~48 m)
const kept = [];
for (const f of feats) {
  const p = f.properties;
  if (p.building) {
    const c = centroidC(f);
    if (!inArea(c)) continue;
    if (waterDistC(c.x, c.z) < 5) continue;
    const w = cToWorld(c);
    if (Math.hypot(w.x, w.z) < PLAZA_CLEAR) continue;
    kept.push(f);
  } else if (p.highway && f.geometry.type === 'LineString') {
    // Keep only the parts of the line inside the area, outside the river and plaza
    const pieces = [];
    let cur = [];
    for (const [g, a] of f.geometry.coordinates) {
      const c = toC(a, g);
      const w = cToWorld(c);
      const ok = inArea(c) && waterDistC(c.x, c.z) > 3 && Math.hypot(w.x, w.z) > PLAZA_CLEAR;
      if (ok) cur.push([g, a]);
      else {
        if (cur.length > 1) pieces.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) pieces.push(cur);
    pieces.forEach((coords, k) => {
      const props = pieces.length > 1 ? { ...p, '@id': `${p['@id']}#${k}` } : p;
      kept.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } });
    });
  }
}
// Strand Road (ကမ်းနားလမ်း) runs along the Ayeyarwady's west bank but is missing from this
// export; add it 35 m inland from the water so the riverside is reachable by road.
{
  const coords = [];
  for (let z = AREA.minZ; z <= AREA.maxZ; z += 30) {
    const r = riverAt(z, RIVER_C);
    const x = r.cx - r.hw - 35;
    if (x > AREA.maxX - 10) break;
    const w = cToWorld({ x, z });
    if (Math.hypot(w.x, w.z) < PLAZA_CLEAR) continue;
    coords.push([C.lng + x / M_PER_LNG, C.lat - z / M_PER_LAT]);
  }
  kept.push({
    type: 'Feature',
    properties: {
      highway: 'tertiary',
      surface: 'asphalt',
      name: 'ကမ်းနားလမ်း',
      'name:my': 'ကမ်းနားလမ်း',
      'name:en': 'Strand Road',
      source: 'game: estimated from riverbank',
    },
    geometry: { type: 'LineString', coordinates: coords },
  });
}

// --- Road segments for physics, traffic and maps ----------------------------
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distSeg(pts[i], a, b);
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}
function distSeg(p, a, b) {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const L = vx * vx + vz * vz;
  const t = L ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.z - a.z) * vz) / L)) : 0;
  return Math.hypot(p.x - (a.x + t * vx), p.z - (a.z + t * vz));
}

const UNPAVED = /unpaved|dirt|ground|gravel|earth|sand|mud|compacted|fine_gravel/;
function roadStyle(p) {
  const h = p.highway;
  const surf = String(p.surface || '');
  if (['trunk', 'primary', 'secondary'].includes(h)) return { surface: 'asphalt', width: 12, rank: 0 };
  if (['trunk_link', 'primary_link', 'secondary_link'].includes(h)) return { surface: 'asphalt', width: 8, rank: 1 };
  if (h === 'tertiary' || h === 'tertiary_link') return { surface: 'asphalt', width: 9, rank: 1 };
  if (h === 'unclassified') return { surface: UNPAVED.test(surf) ? 'laterite_dirt' : 'concrete', width: 7, rank: 2 };
  if (h === 'residential' || h === 'living_street')
    return { surface: UNPAVED.test(surf) ? 'laterite_dirt' : 'concrete', width: 6, rank: 3 };
  if (h === 'service') return { surface: 'laterite_dirt', width: 4.5, rank: 4 };
  if (h === 'track') return { surface: 'laterite_dirt', width: 4, rank: 5 };
  return null; // footways, paths, steps: not drivable
}

const segs = [];
let segN = 0;
for (const f of kept) {
  const p = f.properties;
  if (!p.highway) continue;
  const st = roadStyle(p);
  if (!st) continue;
  const pts = rdp(
    f.geometry.coordinates.map(([g, a]) => toWorld(a, g)),
    1.5,
  );
  const name = String(p['name:my'] || p.name || p['name:en'] || '').trim();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.5) continue;
    segs.push({
      id: `osm_${segN++}`,
      nameMm: name,
      surface: st.surface,
      width: st.width,
      rank: st.rank,
      x1: +a.x.toFixed(1),
      z1: +a.z.toFixed(1),
      x2: +b.x.toFixed(1),
      z2: +b.z.toFixed(1),
    });
  }
}
// Major roads first so traffic and maps can pick them easily
segs.sort((s, t) => s.rank - t.rank);

const segGrid = makeGrid(50);
for (const s of segs) {
  const pad = s.width / 2 + 2;
  segGrid.add(s, Math.min(s.x1, s.x2) - pad, Math.min(s.z1, s.z2) - pad, Math.max(s.x1, s.x2) + pad, Math.max(s.z1, s.z2) + pad);
}
function pointInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

// Merge Microsoft footprints: OSM wins where both map the same building, and footprints
// that sit on a street centerline (misaligned with our OSM streets) are dropped.
let msAdded = 0;
let msDup = 0;
let msOnRoad = 0;
{
  const osmB = kept
    .filter((f) => f.properties.building)
    .map((f) => {
      const poly = f.geometry.coordinates[0].map(([g, a]) => toWorld(a, g));
      const c = cToWorld(centroidC(f));
      return { poly, c };
    });
  const osmGrid = makeGrid(50);
  for (const b of osmB) {
    const xs = b.poly.map((q) => q.x);
    const zs = b.poly.map((q) => q.z);
    osmGrid.add(b, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
  }
  // Park buildings modeled by hand from photos (world meters from the circle center)
  const PARK_CUSTOM = [
    [-7, -89], // open viewing pavilion
    [16, -83], // two-storey white building with red roof
    [-46, -91], // Kachin traditional longhouse (dark steep roof)
  ];
  for (const f of msFeats) {
    const cC = centroidC(f);
    const cw = cToWorld(cC);
    if (PARK_CUSTOM.some(([px, pz]) => Math.hypot(cw.x - px, cw.z - pz) < 9)) continue;
    if (inStationYard(cw)) continue; // tracks, platforms and forecourt are modeled by hand
    if (inPagodaCompound(cw)) continue; // Sutaungpyae Pagoda compound is modeled by hand
    if (!inArea(cC)) continue;
    if (waterDistC(cC.x, cC.z) < 5) continue;
    const c = cToWorld(cC);
    if (Math.hypot(c.x, c.z) < PLAZA_CLEAR) continue;
    const poly = f.geometry.coordinates[0].map(([g, a]) => toWorld(a, g));
    let dup = false;
    for (const b of osmGrid.near(c.x, c.z, 30)) {
      if (pointInPoly(c, b.poly) || pointInPoly(b.c, poly)) {
        dup = true;
        break;
      }
    }
    if (dup) {
      msDup++;
      continue;
    }
    let onRoad = false;
    for (const s of segGrid.near(c.x, c.z, 20)) {
      const a = { x: s.x1, z: s.z1 };
      const b = { x: s.x2, z: s.z2 };
      if (distSeg(c, a, b) < s.width / 2 + 0.5 || poly.some((q) => distSeg(q, a, b) < s.width / 2 - 1)) {
        onRoad = true;
        break;
      }
    }
    if (onRoad) {
      msOnRoad++;
      continue;
    }
    kept.push(f);
    msAdded++;
  }
}

fs.mkdirSync(path.dirname(OUT_GEOJSON), { recursive: true });
fs.writeFileSync(OUT_GEOJSON, JSON.stringify({ type: 'FeatureCollection', features: kept }));

// --- Named places -----------------------------------------------------------
const places = [];
for (const f of kept) {
  const p = f.properties;
  if (!p.building) continue;
  const name = String(p.name || p['name:en'] || p['name:my'] || '').trim();
  if (!name) continue;
  const c = cToWorld(centroidC(f));
  places.push({
    name,
    nameMy: String(p['name:my'] || '').trim(),
    kind: String(p.amenity || p.building),
    x: Math.round(c.x),
    z: Math.round(c.z),
  });
}

// --- Open lots beside streets (for game buildings, shops, props) ------------
// A lot is an empty spot with clear ground of radius r (to buildings and road edges)
// whose edge is within 12 m of a street, so the building fronts that street.
const bldgPolys = kept
  .filter((f) => f.properties.building)
  .map((f) => f.geometry.coordinates[0].map(([g, a]) => toWorld(a, g)));
function distToPoly(p, poly) {
  let inside = false;
  let d = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    d = Math.min(d, distSeg(p, a, b));
  }
  return inside ? 0 : d;
}
const bldgBoxes = bldgPolys.map((poly) => {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const q of poly) {
    x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
  }
  return { x0, x1, z0, z1 };
});
const bldgGrid = makeGrid(40);
bldgPolys.forEach((poly, i) => {
  const b = bldgBoxes[i];
  bldgGrid.add(i, b.x0, b.z0, b.x1, b.z1);
});
const lots = [];
const WB0 = cToWorld({ x: AREA.minX, z: AREA.minZ });
const WB1 = cToWorld({ x: AREA.maxX, z: AREA.maxZ });
for (let x = WB0.x + 60; x <= WB1.x - 60; x += 8) {
  for (let z = WB0.z + 60; z <= WB1.z - 60; z += 8) {
    const c = { x: x + manau.x, z: z + manau.z };
    if (waterDistC(c.x, c.z) < 25) continue;
    if (Math.hypot(x, z) < 75) continue;
    const p = { x, z };
    const R = 40;
    let clear = Math.min(R, stationComplexDist(p), pagodaDist(p)); // no trees or game lots on the rail yard
    for (const i of bldgGrid.near(x, z, R)) {
      if (clear <= 9) break;
      const b = bldgBoxes[i];
      if (x < b.x0 - clear || x > b.x1 + clear || z < b.z0 - clear || z > b.z1 + clear) continue;
      clear = Math.min(clear, distToPoly(p, bldgPolys[i]));
    }
    if (clear <= 9) continue;
    let roadEdge = Infinity;
    for (const s of segGrid.near(x, z, 60)) {
      const d = distSeg(p, { x: s.x1, z: s.z1 }, { x: s.x2, z: s.z2 }) - s.width / 2;
      roadEdge = Math.min(roadEdge, d);
    }
    clear = Math.min(clear, roadEdge);
    if (clear <= 9) continue;
    if (roadEdge - clear > 12) continue; // no street frontage
    lots.push({ x, z, r: Math.floor(clear) });
  }
}
// Greedy: biggest lots first, no overlaps
lots.sort((a, b) => b.r - a.r);
const openLots = [];
for (const l of lots) {
  if (openLots.every((o) => Math.hypot(o.x - l.x, o.z - l.z) > o.r + l.r)) openLots.push(l);
}

// --- Building density grid --------------------------------------------------
const DCELL = 50;
const density = (() => {
  const minX = Math.floor(cToWorld({ x: AREA.minX, z: 0 }).x / DCELL) * DCELL;
  const minZ = Math.floor(cToWorld({ x: 0, z: AREA.minZ }).z / DCELL) * DCELL;
  const cols = Math.ceil((AREA.maxX - AREA.minX) / DCELL) + 2;
  const rows = Math.ceil((AREA.maxZ - AREA.minZ) / DCELL) + 2;
  const counts = new Array(cols * rows).fill(0);
  for (const f of kept) {
    if (!f.properties.building) continue;
    const c = cToWorld(centroidC(f));
    const i = Math.floor((c.x - minX) / DCELL);
    const j = Math.floor((c.z - minZ) / DCELL);
    if (i >= 0 && i < cols && j >= 0 && j < rows) counts[j * cols + i]++;
  }
  return { cell: DCELL, minX, minZ, cols, rows, counts };
})();

// --- Write TS ---------------------------------------------------------------
const W = (o) => cToWorld(o);
const b0 = W({ x: AREA.minX, z: AREA.minZ });
const b1 = W({ x: AREA.maxX, z: AREA.maxZ });
const river = RIVER_C.map((r) => {
  const w = W({ x: r.cx, z: r.z });
  return { z: Math.round(w.z), cx: Math.round(w.x), hw: r.hw };
});

const ts = `// AUTO-GENERATED by scripts/build-map-data.mjs from OpenStreetMap (+ Microsoft building footprints). Do not edit by hand.
// World units are meters (1:1). +x = east, +z = south. Origin (0, 0) = Manau plaza.
import type { RoadSegmentDef } from '../types/game';

/** Lat/lng of the world origin (Manau plaza). */
export const MAP_ORIGIN = { lat: ${ORIGIN.lat.toFixed(6)}, lng: ${ORIGIN.lng.toFixed(6)} };
export const METERS_PER_DEG_LAT = ${M_PER_LAT};
export const METERS_PER_DEG_LNG = ${M_PER_LNG.toFixed(1)};

/** Playable 3 km × 3 km area in world meters. */
export const WORLD_BOUNDS = { minX: ${Math.round(b0.x)}, maxX: ${Math.round(b1.x)}, minZ: ${Math.round(b0.z)}, maxZ: ${Math.round(b1.z)} };
export const WORLD_CENTER = { x: ${Math.round((b0.x + b1.x) / 2)}, z: ${Math.round((b0.z + b1.z) / 2)} };

/** Ayeyarwady centerline control points (sorted by z): center x and half width in meters. */
export const RIVER_POINTS: { z: number; cx: number; hw: number }[] = ${JSON.stringify(river)};

/** Drivable OSM streets inside the play area, major roads first. */
export const OSM_ROAD_SEGMENTS: RoadSegmentDef[] = [
${segs.map(({ rank, ...s }) => '  ' + JSON.stringify(s)).join(',\n')}
];

/** Empty plots beside streets: center and clear radius (m), largest first. */
export const OPEN_LOTS: { x: number; z: number; r: number }[] = ${JSON.stringify(openLots)};

/** Buildings per 50 m cell (row-major from minX/minZ), for density counts and placement. */
export const BUILDING_DENSITY = ${JSON.stringify(density)};

/** Named OSM buildings inside the play area. */
export const OSM_NAMED_PLACES: { name: string; nameMy: string; kind: string; x: number; z: number }[] = ${JSON.stringify(places, null, 2)};
`;
fs.writeFileSync(OUT_TS, ts);

const nb = kept.filter((f) => f.properties.building).length;
const nr = kept.filter((f) => f.properties.highway).length;
console.log(`origin (Manau plaza): ${ORIGIN.lat.toFixed(6)}, ${ORIGIN.lng.toFixed(6)}  (C-rel ${Math.round(manau.x)}, ${Math.round(manau.z)})`);
console.log(`bounds: x ${Math.round(b0.x)}..${Math.round(b1.x)}  z ${Math.round(b0.z)}..${Math.round(b1.z)}`);
console.log(`kept ${nb} buildings, ${nr} road pieces -> ${segs.length} road segments, ${places.length} named places`);
console.log(`microsoft footprints: +${msAdded} added, ${msDup} duplicates of OSM, ${msOnRoad} on streets`);
console.log(`open lots: ${openLots.length} (r>=20: ${openLots.filter((l) => l.r >= 20).length})`);
console.log(`geojson ${(fs.statSync(OUT_GEOJSON).size / 1024).toFixed(0)} KB, ts ${(fs.statSync(OUT_TS).size / 1024).toFixed(0)} KB`);
