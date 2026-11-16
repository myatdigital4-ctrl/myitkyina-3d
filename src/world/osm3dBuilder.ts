import * as THREE from 'three';
import { asphaltDetailTexture, concreteDetailTexture } from './textures';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  DEFAULT_OSM_CITY_SPAWNS,
  MYITKYINA_FAMOUS_BUILDINGS,
  OsmBuildingFootprint,
  OsmCitySpawnPoint,
  OsmNamedPlace,
  OsmRoadPolyline,
  osmLatLngToWorld,
} from '../types/game';
import {
  createSignboardTexture,
  distToSegment,
  groundHeightAt,
  waterSignedDistance,
} from './terrain';

interface GeoJsonFeature {
  type: string;
  id?: string;
  properties?: Record<string, string | number | undefined>;
  geometry?: {
    type: string;
    coordinates: unknown;
  };
}

interface GeoJsonCollection {
  type: string;
  features: GeoJsonFeature[];
}

export interface OsmRoadSegmentSample {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  name: string;
  highway: string;
}

export interface Osm3DBuildResult {
  group: THREE.Group;
  debugGroup: THREE.Group;
  updateDebugOverlay: (playerX: number, playerY: number, playerZ: number) => {
    nearbyBuildings150m: number;
    nearestRoadName: string;
    nearestRoadDistM: number;
  };
  buildingsCount: number;
  roadsCount: number;
  bbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
  citySpawnPoints: OsmCitySpawnPoint[];
  namedPlaces: OsmNamedPlace[];
  roadPolylines: OsmRoadPolyline[];
  buildingFootprints: OsmBuildingFootprint[];
  colliders: { x: number; z: number; r: number }[];
}

// Convert XML .osm string into GeoJSON FeatureCollection so users can also upload raw .osm files
export function parseOsmXmlToGeoJson(xmlText: string): GeoJsonCollection {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const nodeMap = new Map<string, [number, number]>();

  const nodes = doc.getElementsByTagName('node');
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const id = n.getAttribute('id');
    const lat = parseFloat(n.getAttribute('lat') || '0');
    const lon = parseFloat(n.getAttribute('lon') || '0');
    if (id && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      nodeMap.set(id, [lon, lat]);
    }
  }

  const features: GeoJsonFeature[] = [];
  const ways = doc.getElementsByTagName('way');
  for (let i = 0; i < ways.length; i++) {
    const w = ways[i];
    const id = w.getAttribute('id') || `way_${i}`;
    const nds = w.getElementsByTagName('nd');
    const coords: [number, number][] = [];
    for (let j = 0; j < nds.length; j++) {
      const ref = nds[j].getAttribute('ref');
      if (ref && nodeMap.has(ref)) {
        coords.push(nodeMap.get(ref)!);
      }
    }
    if (coords.length < 2) continue;

    const props: Record<string, string> = { '@id': `way/${id}` };
    const tags = w.getElementsByTagName('tag');
    for (let t = 0; t < tags.length; t++) {
      const k = tags[t].getAttribute('key') || tags[t].getAttribute('k');
      const v = tags[t].getAttribute('value') || tags[t].getAttribute('v');
      if (k && v) props[k] = v;
    }

    const isClosed =
      coords.length >= 4 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1];

    if (props.building || (isClosed && !props.highway)) {
      features.push({
        type: 'Feature',
        id: `way/${id}`,
        properties: props,
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      });
    } else if (props.highway) {
      features.push({
        type: 'Feature',
        id: `way/${id}`,
        properties: props,
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

function createStreetSignTexture(
  renderer: THREE.WebGLRenderer,
  roadName: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 112;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 512, 112);

  ctx.fillStyle = '#0284c7';
  ctx.fillRect(6, 6, 500, 100);

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 92);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(roadName, 256, 56, 468);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

// Build a terrain-following 3D road ribbon BufferGeometry from a polyline of world (x, z) points
function createRoadRibbonGeometry(
  pts: { x: number; z: number }[],
  width: number,
  yOffset: number,
): THREE.BufferGeometry | null {
  if (pts.length < 2) return null;

  // Subdivide every 5m so the ribbon hugs terrain elevation with zero terrain poking through
  const refined: { x: number; z: number }[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.min(24, Math.ceil(dist / 5)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      refined.push({
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
      });
    }
  }

  const n = refined.length;
  if (n < 2) return null;

  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices: number[] = [];

  const halfW = width * 0.5;
  let runningLen = 0;

  for (let i = 0; i < n; i++) {
    const p = refined[i];
    if (i > 0) {
      runningLen += Math.hypot(p.x - refined[i - 1].x, p.z - refined[i - 1].z);
    }

    let tx = 0;
    let tz = 0;
    if (i < n - 1) {
      tx += refined[i + 1].x - p.x;
      tz += refined[i + 1].z - p.z;
    }
    if (i > 0) {
      tx += p.x - refined[i - 1].x;
      tz += p.z - refined[i - 1].z;
    }
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;

    // Right-handed perpendicular normal in XZ plane so triangle winding faces UP (+Y)
    const nx = -tz;
    const nz = tx;

    const lx = p.x - nx * halfW;
    const lz = p.z - nz * halfW;
    const rx = p.x + nx * halfW;
    const rz = p.z + nz * halfW;

    const ly = groundHeightAt(lx, lz) + yOffset;
    const ry = groundHeightAt(rx, rz) + yOffset;

    const vIdx = i * 6;
    positions[vIdx] = lx;
    positions[vIdx + 1] = ly;
    positions[vIdx + 2] = lz;

    positions[vIdx + 3] = rx;
    positions[vIdx + 4] = ry;
    positions[vIdx + 5] = rz;

    normals[vIdx] = 0;
    normals[vIdx + 1] = 1;
    normals[vIdx + 2] = 0;
    normals[vIdx + 3] = 0;
    normals[vIdx + 4] = 1;
    normals[vIdx + 5] = 0;

    const uIdx = i * 4;
    uvs[uIdx] = 0;
    uvs[uIdx + 1] = runningLen * 0.1;
    uvs[uIdx + 2] = 1;
    uvs[uIdx + 3] = runningLen * 0.1;

    if (i < n - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/** Polyline shifted sideways by `d` meters (positive = right of travel direction). */
function offsetPolyline(pts: { x: number; z: number }[], d: number): { x: number; z: number }[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // right-hand normal of (dx, dz) is (-dz, dx)
    return { x: p.x + (-(b.z - a.z) / len) * d, z: p.z + ((b.x - a.x) / len) * d };
  });
}

/** Common Myitkyina street-shop signs, painted into one 4×4 atlas (one draw call for all signs). */
const SHOP_SIGNS: { text: string; bg: string; fg: string }[] = [
  { text: 'လက်ဖက်ရည်ဆိုင်', bg: '#b91c1c', fg: '#fef3c7' },
  { text: 'ကုန်စုံဆိုင်', bg: '#1d4ed8', fg: '#ffffff' },
  { text: 'ဖုန်းဆိုင်', bg: '#0f766e', fg: '#ffffff' },
  { text: 'ဆေးဆိုင်', bg: '#15803d', fg: '#ffffff' },
  { text: 'ထမင်းဆိုင်', bg: '#c2410c', fg: '#fff7ed' },
  { text: 'ရွှေဆိုင်', bg: '#a16207', fg: '#fef9c3' },
  { text: 'အလှပြင်ဆိုင်', bg: '#be185d', fg: '#fdf2f8' },
  { text: 'စာအုပ်ဆိုင်', bg: '#334155', fg: '#f8fafc' },
  { text: 'ဆိုင်ကယ်ပြင်', bg: '#1e293b', fg: '#facc15' },
  { text: 'ကော်ဖီဆိုင်', bg: '#78350f', fg: '#fef3c7' },
  { text: 'မုန့်ဟင်းခါး', bg: '#9a3412', fg: '#ffedd5' },
  { text: 'အထည်ဆိုင်', bg: '#6d28d9', fg: '#f5f3ff' },
  { text: 'ကချင်ရိုးရာ', bg: '#7f1d1d', fg: '#fde68a' },
  { text: 'ငွေလွှဲ', bg: '#0369a1', fg: '#ffffff' },
  { text: 'ဟာ့ဒ်ဝဲ', bg: '#57534e', fg: '#fafaf9' },
  { text: 'ဘေကရီ', bg: '#db2777', fg: '#ffffff' },
];
function createShopSignAtlas(): THREE.CanvasTexture {
  const cw = 256;
  const ch = 72;
  const c = document.createElement('canvas');
  c.width = cw * 4;
  c.height = ch * 4;
  const g = c.getContext('2d')!;
  SHOP_SIGNS.forEach((sgn, i) => {
    const x = (i % 4) * cw;
    const y = Math.floor(i / 4) * ch;
    g.fillStyle = sgn.bg;
    g.fillRect(x, y, cw, ch);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 4;
    g.strokeRect(x + 4, y + 4, cw - 8, ch - 8);
    g.fillStyle = sgn.fg;
    g.font = 'bold 30px "Noto Sans Myanmar", "Myanmar Sangam MN", "Padauk", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(sgn.text, x + cw / 2, y + ch / 2 + 2, cw - 20);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Smallest-area rectangle around a polygon (local x/y), tested along each edge direction. */
function orientedBox(pts: { x: number; y: number }[]) {
  let best = { area: Infinity, angle: 0, cu: 0, cv: 0, L: 0, D: 0 };
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const p of pts) {
      const u = p.x * c + p.y * s;
      const v = -p.x * s + p.y * c;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (area < best.area) {
      best = { area, angle: ang, cu: (u0 + u1) / 2, cv: (v0 + v1) / 2, L: u1 - u0, D: v1 - v0 };
    }
  }
  // Keep L as the long side
  if (best.D > best.L) {
    best = { ...best, angle: best.angle + Math.PI / 2, cu: best.cv, cv: -best.cu, L: best.D, D: best.L };
  }
  return best;
}

/**
 * Pitched zinc roof (hip or gable) over an oriented rectangle, the common Myitkyina house roof.
 * Local frame: u along the long side, v across. Returns world-space, non-indexed geometry.
 */
function buildPitchedRoof(
  box: ReturnType<typeof orientedBox>,
  cx: number,
  cz: number,
  y0: number,
  hip: boolean,
): THREE.BufferGeometry {
  const o = 0.45; // eave overhang
  const hu = box.L / 2 + o;
  const hv = box.D / 2 + o;
  const rise = Math.min(3.2, Math.max(1.0, box.D * 0.32));
  const ridgeHalf = hip ? Math.max(0, box.L / 2 - box.D / 2) : hu;
  const c = Math.cos(box.angle);
  const s = Math.sin(box.angle);
  // local (u, v, h) -> world (x, y, z); local y axis of the footprint points to -z
  const w = (u: number, v: number, h: number) => {
    const lx = box.cu * c - box.cv * s + u * c - v * s;
    const ly = box.cu * s + box.cv * c + u * s + v * c;
    return [cx + lx, y0 + h, cz - ly];
  };
  const A = w(-hu, -hv, 0), B = w(hu, -hv, 0), C = w(hu, hv, 0), D = w(-hu, hv, 0);
  const R1 = w(-ridgeHalf, 0, rise), R2 = w(ridgeHalf, 0, rise);
  const tris: number[][] = [
    // long slopes
    A, B, R2, A, R2, R1,
    C, D, R1, C, R1, R2,
    // ends (hip slopes or vertical gable triangles)
    B, C, R2,
    D, A, R1,
  ];
  const pos = new Float32Array(tris.length * 3);
  tris.forEach((p, i) => pos.set(p, i * 3));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(tris.length * 2), 2));
  g.computeVertexNormals();
  return g;
}

/** Plastered wall with a window per ~3 m and per storey (tinted by the wall material color). */
function createWindowWallTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  // Floor band
  g.fillStyle = '#d6d3d1';
  g.fillRect(0, 118, 128, 10);
  // Window: frame, glass, mullion
  g.fillStyle = '#e7e5e4';
  g.fillRect(34, 30, 60, 58);
  g.fillStyle = '#3b4f5c';
  g.fillRect(39, 35, 50, 48);
  g.fillStyle = '#5b7282';
  g.fillRect(39, 35, 50, 14);
  g.fillStyle = '#e7e5e4';
  g.fillRect(62, 35, 4, 48);
  // Sill
  g.fillStyle = '#a8a29e';
  g.fillRect(30, 88, 68, 5);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // UVs of extruded walls are in meters: one tile = 3 m wide x 3.2 m (one storey) tall
  tex.repeat.set(1 / 3, 1 / 3.2);
  tex.anisotropy = 4;
  return tex;
}

export function buildMyitkyinaOsm3DGroup(
  geojson: GeoJsonCollection,
  renderer: THREE.WebGLRenderer,
): Osm3DBuildResult {
  const group = new THREE.Group();
  group.name = 'MyitkyinaOsm3DCityGroup';

  const namedPlaces: OsmNamedPlace[] = [];
  const roadPolylines: OsmRoadPolyline[] = [];
  const buildingFootprints: OsmBuildingFootprint[] = [];
  const colliders: { x: number; z: number; r: number }[] = [];
  const buildingCentroids: { x: number; z: number }[] = [];
  const roadSegments: OsmRoadSegmentSample[] = [];

  // Track exact GeoJSON bounding box (Buildings & Roads)
  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  // Geometry buckets for single-draw-call merged rendering
  const wallBuckets: Record<string, THREE.BufferGeometry[]> = {
    civic: [],
    hospital: [],
    school: [],
    religious: [],
    residentialCream: [],
    residentialTeal: [],
    residentialWarm: [],
    residentialBrick: [],
  };
  const roofBuckets: Record<string, THREE.BufferGeometry[]> = {
    redZinc: [],
    blueZinc: [],
    greenZinc: [],
    goldCivic: [],
    darkSlate: [],
    lightZinc: [],
    maroonZinc: [],
  };

  const roadTrunkGeos: THREE.BufferGeometry[] = [];
  const roadCenterLineGeos: THREE.BufferGeometry[] = [];
  const roadResidentialGeos: THREE.BufferGeometry[] = [];
  const roadServiceGeos: THREE.BufferGeometry[] = [];
  const sidewalkGeos: THREE.BufferGeometry[] = [];
  const curbGeos: THREE.BufferGeometry[] = [];
  const signPositions: number[] = [];
  const signUvs: number[] = [];
  let signCount = 0;

  const labeledStreetNames = new Set<string>();
  const labeledBuildingNames = new Set<string>();

  let buildingsCount = 0;
  let roadsCount = 0;

  const features = geojson.features || [];

  // ==========================================================================
  // PASS 1: EXTRACT ALL OSM ROAD SEGMENTS FIRST (for road-clearance checks)
  // ==========================================================================
  for (let fIdx = 0; fIdx < features.length; fIdx++) {
    const feat = features[fIdx];
    const props = feat.properties || {};
    const geom = feat.geometry;
    if (!geom || geom.type !== 'LineString' || !props.highway) continue;

    const coords = geom.coordinates as number[][];
    if (!coords || coords.length < 2) continue;

    const hwy = String(props.highway);
    const roadName = String(props.name || props['name:my'] || props['name:en'] || '').trim();

    const worldPts: { x: number; z: number }[] = [];
    for (let i = 0; i < coords.length; i++) {
      // GeoJSON standard order is [longitude, latitude]
      const lng = Number(coords[i][0]);
      const lat = Number(coords[i][1]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

      const pt = osmLatLngToWorld(lat, lng);

      // Skip points that cross inside river channel or Manau dance ring
      if (waterSignedDistance(pt.x, pt.z) < 6) continue;
      if (Math.hypot(pt.x, pt.z) < 35) continue;

      worldPts.push(pt);
    }

    if (worldPts.length < 2) continue;

    for (let i = 0; i < worldPts.length - 1; i++) {
      roadSegments.push({
        x1: worldPts[i].x,
        z1: worldPts[i].z,
        x2: worldPts[i + 1].x,
        z2: worldPts[i + 1].z,
        name: roadName || `${hwy} road`,
        highway: hwy,
      });
    }

    // Elevated yOffset (0.20..0.30) and realistic street widths so OSM roads stand out crisply
    // Real-world carriageway widths in meters (map is 1:1)
    let width = 4;
    let yOffset = 0.14;
    if (hwy === 'trunk' || hwy === 'primary' || hwy === 'secondary') {
      width = 12;
      yOffset = 0.2;
    } else if (hwy === 'trunk_link' || hwy === 'tertiary' || hwy === 'tertiary_link') {
      width = 9;
      yOffset = 0.18;
    } else if (hwy === 'unclassified') {
      width = 7;
      yOffset = 0.16;
    } else if (hwy === 'residential' || hwy === 'living_street') {
      width = 6;
      yOffset = 0.15;
    } else if (hwy === 'footway' || hwy === 'path' || hwy === 'steps' || hwy === 'pedestrian') {
      width = 2;
      yOffset = 0.13;
    }

    const ribbonGeo = createRoadRibbonGeometry(worldPts, width, yOffset);
    if (ribbonGeo) {
      if (
        hwy === 'trunk' ||
        hwy === 'primary' ||
        hwy === 'trunk_link' ||
        hwy === 'secondary' ||
        hwy === 'tertiary'
      ) {
        roadTrunkGeos.push(ribbonGeo);
        const centerLineGeo = createRoadRibbonGeometry(worldPts, 0.18, yOffset + 0.02);
        if (centerLineGeo) roadCenterLineGeos.push(centerLineGeo);
        // Sidewalks with a curb on both sides of main streets
        for (const side of [1, -1]) {
          const walk = createRoadRibbonGeometry(offsetPolyline(worldPts, side * (width / 2 + 1.1)), 2.0, 0.24);
          if (walk) sidewalkGeos.push(walk);
          const curb = createRoadRibbonGeometry(offsetPolyline(worldPts, side * (width / 2 + 0.08)), 0.18, 0.3);
          if (curb) curbGeos.push(curb);
        }
      } else if (hwy === 'residential' || hwy === 'living_street' || hwy === 'unclassified') {
        roadResidentialGeos.push(ribbonGeo);
      } else {
        roadServiceGeos.push(ribbonGeo);
      }
      roadsCount++;
    }

    // Store polyline for ALL OSM roads so Mini Map and 3D Scene match 100%!
    const simplified: { x: number; z: number }[] = [
      {
        x: Math.round(worldPts[0].x * 10) / 10,
        z: Math.round(worldPts[0].z * 10) / 10,
      },
    ];
    for (let i = 1; i < worldPts.length - 1; i++) {
      const prev = simplified[simplified.length - 1];
      if (Math.hypot(worldPts[i].x - prev.x, worldPts[i].z - prev.z) > 8) {
        simplified.push({
          x: Math.round(worldPts[i].x * 10) / 10,
          z: Math.round(worldPts[i].z * 10) / 10,
        });
      }
    }
    simplified.push({
      x: Math.round(worldPts[worldPts.length - 1].x * 10) / 10,
      z: Math.round(worldPts[worldPts.length - 1].z * 10) / 10,
    });

    roadPolylines.push({
      id: String(feat.id || props['@id'] || `osm_rd_${roadsCount}`),
      name: roadName,
      highway: hwy,
      points: simplified,
    });

    // Add 3D Street Signpost & GPS Explorer entry for named OpenStreetMap streets
    if (roadName.length > 0 && !labeledStreetNames.has(roadName)) {
      labeledStreetNames.add(roadName);
      const midPt = worldPts[Math.floor(worldPts.length / 2)];
      const signY = groundHeightAt(midPt.x, midPt.z);

      const streetTex = createStreetSignTexture(renderer, `🛣️ ${roadName}`);
      const signPlate = new THREE.Mesh(
        new THREE.BoxGeometry(6.2, 1.4, 0.18),
        new THREE.MeshBasicMaterial({ map: streetTex }),
      );
      signPlate.position.set(midPt.x + 3.2, signY + 4.2, midPt.z);
      group.add(signPlate);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.12, 4.2, 8),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.7, roughness: 0.35 }),
      );
      pole.position.set(midPt.x + 3.2, signY + 2.1, midPt.z);
      group.add(pole);

      if (namedPlaces.length < 52) {
        const midCoord = coords[Math.floor(coords.length / 2)];
        namedPlaces.push({
          id: `street_${roadsCount}`,
          nameMm: roadName,
          nameEn: `OSM Street (${hwy})`,
          category: 'လမ်းမကြီး (OSM Street)',
          x: Math.round(midPt.x),
          z: Math.round(midPt.z),
          lat: Number(Number(midCoord[1]).toFixed(5)),
          lng: Number(Number(midCoord[0]).toFixed(5)),
        });
      }
    }
  }

  // ==========================================================================
  // PASS 2: 3D EXTRUDED OPENSTREETMAP BUILDINGS (1,123+ Polygons)
  // ==========================================================================
  for (let fIdx = 0; fIdx < features.length; fIdx++) {
    const feat = features[fIdx];
    const props = feat.properties || {};
    const geom = feat.geometry;
    if (!geom) continue;

    if (
      (geom.type === 'Polygon' || geom.type === 'MultiPolygon') &&
      props.building
    ) {
      const rawRing =
        geom.type === 'Polygon'
          ? (geom.coordinates as number[][][])[0]
          : (geom.coordinates as number[][][][])[0]?.[0];

      if (!rawRing || rawRing.length < 3) continue;

      const worldRing: { x: number; z: number }[] = [];
      let sumX = 0;
      let sumZ = 0;
      let sumLat = 0;
      let sumLng = 0;

      const ringLen =
        rawRing.length > 3 &&
        rawRing[0][0] === rawRing[rawRing.length - 1][0] &&
        rawRing[0][1] === rawRing[rawRing.length - 1][1]
          ? rawRing.length - 1
          : rawRing.length;

      for (let i = 0; i < ringLen; i++) {
        // GeoJSON standard order: [longitude, latitude]
        const lng = Number(rawRing[i][0]);
        const lat = Number(rawRing[i][1]);
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

        const pt = osmLatLngToWorld(lat, lng);
        worldRing.push(pt);
        sumX += pt.x;
        sumZ += pt.z;
        sumLat += lat;
        sumLng += lng;

        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.z < minZ) minZ = pt.z;
        if (pt.z > maxZ) maxZ = pt.z;
      }

      if (worldRing.length < 3) continue;

      const cx = sumX / worldRing.length;
      const cz = sumZ / worldRing.length;
      const cLat = sumLat / worldRing.length;
      const cLng = sumLng / worldRing.length;

      // Keep river channel & Sitapu Manau ceremonial plaza clear
      if (waterSignedDistance(cx, cz) < 8) continue;
      if (Math.hypot(cx, cz) < 42) continue;

      // Avoid overlapping our custom interactive hero buildings
      let overlapsHero = false;
      for (let b = 0; b < MYITKYINA_FAMOUS_BUILDINGS.length; b++) {
        const hero = MYITKYINA_FAMOUS_BUILDINGS[b];
        if (Math.hypot(cx - hero.x, cz - hero.z) < Math.max(hero.width, hero.depth) * 0.72) {
          overlapsHero = true;
          break;
        }
      }
      if (overlapsHero) continue;

      // Calculate exact footprint span
      let bMinX = Infinity;
      let bMaxX = -Infinity;
      let bMinZ = Infinity;
      let bMaxZ = -Infinity;
      for (let i = 0; i < worldRing.length; i++) {
        if (worldRing[i].x < bMinX) bMinX = worldRing[i].x;
        if (worldRing[i].x > bMaxX) bMaxX = worldRing[i].x;
        if (worldRing[i].z < bMinZ) bMinZ = worldRing[i].z;
        if (worldRing[i].z > bMaxZ) bMaxZ = worldRing[i].z;
      }
      const spanX = Math.max(0.8, bMaxX - bMinX);
      const spanZ = Math.max(0.8, bMaxZ - bMinZ);
      const maxSpan = Math.max(spanX, spanZ);

      // Use true 1:1 OpenStreetMap polygon footprint with an 8% inset margin (0.92)
      // so adjacent houses in dense blocks NEVER collide or overlap each other!
      const footprintScale = 0.92;

      const bType = String(props.building || 'yes');
      const nameRaw = String(props.name || props['name:my'] || props['name:en'] || '').trim();
      const nameEnRaw = String(props['name:en'] || props.name || '').trim();
      const levels = Number(props['building:levels'] || 0);

      // Determine realistic, proportional 3D building height & style bucket from OpenStreetMap tags
      let height = 3.8;
      let wallKey: keyof typeof wallBuckets = 'residentialCream';
      let roofKey: keyof typeof roofBuckets = 'redZinc';

      const hash = Math.abs(Math.floor(cx * 17 + cz * 31));

      if (bType === 'train_station' || nameRaw.includes('ဘူတာ') || nameRaw.includes('City Hall')) {
        height = 9.5;
        wallKey = 'civic';
        roofKey = 'goldCivic';
      } else if (bType === 'hospital') {
        height = 8.2 + (hash % 3) * 1.2;
        wallKey = 'hospital';
        roofKey = 'blueZinc';
      } else if (bType === 'school' || nameRaw.includes('College') || nameRaw.includes('Hostel')) {
        height = 7.6 + (hash % 2) * 1.4;
        wallKey = 'school';
        roofKey = 'greenZinc';
      } else if (
        bType === 'church' ||
        props.amenity === 'place_of_worship' ||
        nameRaw.includes('Church') ||
        nameRaw.includes('ကျောင်း') ||
        nameRaw.includes('Temple') ||
        nameRaw.includes('အသင်းတော်')
      ) {
        height = 8.8;
        wallKey = 'religious';
        roofKey = 'goldCivic';
      } else if (bType === 'apartments' || bType === 'grandstand') {
        height = 7.8 + (hash % 3) * 1.4;
        wallKey = 'residentialTeal';
        roofKey = 'darkSlate';
      } else if (nameRaw.length > 0) {
        height = 6.8 + (hash % 3) * 1.1;
        wallKey = hash % 2 === 0 ? 'civic' : 'residentialTeal';
        roofKey = hash % 2 === 0 ? 'blueZinc' : 'redZinc';
      } else {
        // Proportional height for Myitkyina residential homes (1 to 2 stories)
        // Myitkyina homes: mostly 1 storey, larger footprints often 2 storeys (~3.2 m per floor)
        height =
          levels > 0
            ? Math.min(16, levels * 3.2)
            : maxSpan > 18
              ? 6.4 + (hash % 3) * 0.3
              : 3.4 + (hash % 3) * 0.35;
        const wallChoices: (keyof typeof wallBuckets)[] = [
          'residentialCream',
          'residentialTeal',
          'residentialWarm',
          'residentialBrick',
        ];
        // Weighted like Myitkyina satellite imagery: mostly rust-red/brown and grey zinc,
        // a few blue, rarely green
        const roofChoices: (keyof typeof roofBuckets)[] = [
          'redZinc', 'redZinc', 'redZinc', 'redZinc', 'redZinc',
          'lightZinc', 'lightZinc', 'lightZinc',
          'darkSlate', 'darkSlate',
          'blueZinc',
          'greenZinc',
        ];
        wallKey = wallChoices[hash % wallChoices.length];
        roofKey = roofChoices[(hash >> 2) % roofChoices.length];
      }

      // Park buildings matched to the 19z Google satellite (world meters from the circle center)
      const PARK_ROOFS: [number, number, keyof typeof roofBuckets][] = [
        [-139, 46, 'maroonZinc'], // long hall: white walls, maroon roof (visitor photo)
        [100, -62, 'redZinc'], // east building
        [-126, 90, 'redZinc'], // row of red gables south of the hall
        [-139, 81, 'redZinc'],
        [-74, -98, 'redZinc'],
      ];
      let forcePitched = false;
      for (const [px, pz, rk] of PARK_ROOFS) {
        if (Math.hypot(cx - px, cz - pz) < 8) {
          roofKey = rk;
          wallKey = 'residentialCream';
          forcePitched = true;
        }
      }

      // Filter consecutive duplicate vertices (< 0.05 units) and ensure consistent CCW winding
      const cleanLocalPts: { x: number; y: number }[] = [];
      for (let i = 0; i < worldRing.length; i++) {
        const lx = (worldRing[i].x - cx) * footprintScale;
        const ly = -(worldRing[i].z - cz) * footprintScale;
        if (
          cleanLocalPts.length === 0 ||
          Math.hypot(
            lx - cleanLocalPts[cleanLocalPts.length - 1].x,
            ly - cleanLocalPts[cleanLocalPts.length - 1].y,
          ) > 0.05
        ) {
          cleanLocalPts.push({ x: lx, y: ly });
        }
      }
      if (
        cleanLocalPts.length > 2 &&
        Math.hypot(
          cleanLocalPts[0].x - cleanLocalPts[cleanLocalPts.length - 1].x,
          cleanLocalPts[0].y - cleanLocalPts[cleanLocalPts.length - 1].y,
        ) <= 0.05
      ) {
        cleanLocalPts.pop();
      }
      if (cleanLocalPts.length < 3) continue;

      let signedArea = 0;
      for (let i = 0; i < cleanLocalPts.length; i++) {
        const p1 = cleanLocalPts[i];
        const p2 = cleanLocalPts[(i + 1) % cleanLocalPts.length];
        signedArea += p1.x * p2.y - p2.x * p1.y;
      }
      if (signedArea < 0) {
        cleanLocalPts.reverse();
      }

      // The raised roof crown is a 0.68× copy around the centroid; on L/U-shaped
      // footprints that copy pokes outside the walls, so only convex roofs get one.
      let isConvex = true;
      for (let i = 0; i < cleanLocalPts.length && isConvex; i++) {
        const a = cleanLocalPts[i];
        const b = cleanLocalPts[(i + 1) % cleanLocalPts.length];
        const c = cleanLocalPts[(i + 2) % cleanLocalPts.length];
        if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < -1e-6) isConvex = false;
      }

      const wallShape = new THREE.Shape();
      const crownShape = new THREE.Shape();
      for (let i = 0; i < cleanLocalPts.length; i++) {
        const px = cleanLocalPts[i].x;
        const py = cleanLocalPts[i].y;
        if (i === 0) {
          wallShape.moveTo(px, py);
          crownShape.moveTo(px * 0.68, py * 0.68);
        } else {
          wallShape.lineTo(px, py);
          crownShape.lineTo(px * 0.68, py * 0.68);
        }
      }
      wallShape.closePath();
      crownShape.closePath();

      const baseY = groundHeightAt(cx, cz) - 0.08;

      const wallGeo = new THREE.ExtrudeGeometry(wallShape, {
        depth: height,
        bevelEnabled: false,
      });
      wallGeo.rotateX(-Math.PI / 2);
      wallGeo.translate(cx, baseY, cz);
      wallBuckets[wallKey].push(wallGeo);

      // Roofs: houses that are roughly rectangular get a pitched zinc roof (hip or gable),
      // large / irregular buildings get a flat concrete roof slab with a parapet.
      const box = orientedBox(cleanLocalPts);
      const footprintArea = Math.abs(signedArea) / 2;
      const fill = footprintArea / Math.max(1, box.L * box.D);
      const pitched = forcePitched || (fill > 0.78 && footprintArea < 650 && height < 10 && box.D > 3);
      if (pitched) {
        roofBuckets[roofKey].push(buildPitchedRoof(box, cx, cz, baseY + height, hash % 3 !== 0));
      } else {
        const roofBaseGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 0.3, bevelEnabled: false });
        roofBaseGeo.rotateX(-Math.PI / 2);
        roofBaseGeo.translate(cx, baseY + height, cz);
        roofBuckets.darkSlate.push(roofBaseGeo);
        if (isConvex) {
          // Low parapet ring: outer slab minus a slightly smaller inner slab reads as a parapet edge
          const parapet = new THREE.ExtrudeGeometry(crownShape, { depth: 0.12, bevelEnabled: false });
          parapet.rotateX(-Math.PI / 2);
          parapet.translate(cx, baseY + height + 0.3, cz);
          roofBuckets.darkSlate.push(parapet);
        }
      }

      const roofHexMap: Record<keyof typeof roofBuckets, string> = {
        redZinc: '#ef4444',
        blueZinc: '#0ea5e9',
        greenZinc: '#22c55e',
        goldCivic: '#f59e0b',
        darkSlate: '#64748b',
        lightZinc: '#b9bdbd',
        maroonZinc: '#7a2e2a',
      };
      // Shop signboard on buildings that front a main street (about half of them)
      if (hash % 2 === 0 && signCount < 2500) {
        let best: OsmRoadSegmentSample | null = null;
        let bestD = 22;
        let bx = 0;
        let bz = 0;
        for (const seg of roadSegments) {
          const h = seg.highway;
          if (h !== 'trunk' && h !== 'primary' && h !== 'secondary' && h !== 'tertiary' && h !== 'unclassified') continue;
          if (Math.abs(seg.x1 - cx) > 60 && Math.abs(seg.x2 - cx) > 60) continue;
          if (Math.abs(seg.z1 - cz) > 60 && Math.abs(seg.z2 - cz) > 60) continue;
          const vx = seg.x2 - seg.x1;
          const vz = seg.z2 - seg.z1;
          const L2 = vx * vx + vz * vz || 1;
          const t = Math.max(0, Math.min(1, ((cx - seg.x1) * vx + (cz - seg.z1) * vz) / L2));
          const px = seg.x1 + vx * t;
          const pz = seg.z1 + vz * t;
          const d = Math.hypot(px - cx, pz - cz);
          if (d < bestD) {
            bestD = d;
            best = seg;
            bx = px;
            bz = pz;
          }
        }
        if (best) {
          // Direction to the street; walk from the centroid to the wall in that direction
          const dx = (bx - cx) / (bestD || 1);
          const dz = (bz - cz) / (bestD || 1);
          let wallDist = 0;
          for (let step = 0; step < 60; step++) {
            const qx = dx * step * 0.5;
            const qy = -dz * step * 0.5;
            let inside = false;
            for (let i = 0, j = cleanLocalPts.length - 1; i < cleanLocalPts.length; j = i++) {
              const a = cleanLocalPts[i];
              const b = cleanLocalPts[j];
              if (a.y > qy !== b.y > qy && qx < ((b.x - a.x) * (qy - a.y)) / (b.y - a.y) + a.x) inside = !inside;
            }
            if (!inside) break;
            wallDist = step * 0.5;
          }
          const sw = Math.min(4.2, Math.max(2.2, maxSpan * 0.45));
          const shh = sw * 0.28;
          const sx = cx + dx * (wallDist + 0.35);
          const sz = cz + dz * (wallDist + 0.35);
          const sy = baseY + Math.min(height - 0.4, 3.1);
          // Sign plane faces the street: right vector perpendicular to (dx, dz)
          const rx = -dz * (sw / 2);
          const rz = dx * (sw / 2);
          const corners = [
            [sx - rx, sy - shh / 2, sz - rz],
            [sx + rx, sy - shh / 2, sz + rz],
            [sx + rx, sy + shh / 2, sz + rz],
            [sx - rx, sy + shh / 2, sz - rz],
          ];
          const idx = (hash >> 3) % SHOP_SIGNS.length;
          const u0 = (idx % 4) / 4;
          const v0 = 1 - (Math.floor(idx / 4) + 1) / 4;
          const uv = [
            [u0 + 0.25, v0],
            [u0, v0],
            [u0, v0 + 0.25],
            [u0 + 0.25, v0 + 0.25],
          ];
          for (const k of [0, 1, 2, 0, 2, 3]) {
            signPositions.push(...corners[k]);
            signUvs.push(...uv[k]);
          }
          signCount++;
        }
      }

      buildingFootprints.push({
        x: Math.round(cx * 10) / 10,
        z: Math.round(cz * 10) / 10,
        w: Math.max(1.4, Math.round(spanX * footprintScale * 10) / 10),
        d: Math.max(1.4, Math.round(spanZ * footprintScale * 10) / 10),
        color: roofHexMap[roofKey],
      });

      buildingsCount++;
      buildingCentroids.push({ x: cx, z: cz });

      // Add collision radius for larger OSM buildings
      const approxRadius = Math.max(spanX, spanZ) * footprintScale * 0.36;
      if (approxRadius >= 2.0) {
        colliders.push({ x: cx, z: cz, r: Math.min(12, approxRadius) });
      }

      // Named OSM Landmark Buildings get 3D Burmese/English Signboards & GPS Explorer entry!
      if (nameRaw.length > 0 && !labeledBuildingNames.has(nameRaw)) {
        labeledBuildingNames.add(nameRaw);

        const categoryLabel =
          bType === 'train_station'
            ? 'ဘူတာရုံ (Station)'
            : bType === 'hospital'
              ? 'ဆေးရုံ (Hospital)'
              : bType === 'school'
                ? 'ကျောင်း (School)'
                : props.amenity === 'place_of_worship' || bType === 'church'
                  ? 'ဘာသာရေး (Religious)'
                  : 'အထင်ကရနေရာ (OSM Landmark)';

        namedPlaces.push({
          id: String(feat.id || props['@id'] || `osm_bldg_${buildingsCount}`),
          nameMm: nameRaw,
          nameEn: nameEnRaw || categoryLabel,
          category: categoryLabel,
          x: Math.round(cx),
          z: Math.round(cz),
          lat: Number(cLat.toFixed(5)),
          lng: Number(cLng.toFixed(5)),
        });

        const signTex = createSignboardTexture(
          renderer,
          nameRaw,
          nameEnRaw || categoryLabel,
          '#0f172a',
          '#38bdf8',
        );
        const signBoard = new THREE.Mesh(
          new THREE.BoxGeometry(8.2, 2.4, 0.28),
          new THREE.MeshBasicMaterial({ map: signTex }),
        );
        signBoard.position.set(cx, baseY + height + 3.4, cz);
        group.add(signBoard);

        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 3.0, 8),
          new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.4 }),
        );
        post.position.set(cx, baseY + height + 1.6, cz);
        group.add(post);
      }
    }
  }

  // ==========================================================================
  // 3. MERGE GEOMETRIES BY MATERIAL BUCKET WITH FRUSTUM CULLING DISABLED
  // ==========================================================================
  const windowTex = createWindowWallTexture();
  const wallMaterials: Record<keyof typeof wallBuckets, THREE.MeshStandardMaterial> = {
    civic: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6, metalness: 0.14, side: THREE.DoubleSide, map: windowTex }),
    hospital: new THREE.MeshStandardMaterial({ color: '#bae6fd', roughness: 0.55, metalness: 0.12, side: THREE.DoubleSide, map: windowTex }),
    school: new THREE.MeshStandardMaterial({ color: '#fde68a', roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide, map: windowTex }),
    religious: new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.5, metalness: 0.2, side: THREE.DoubleSide, map: windowTex }),
    residentialCream: new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide, map: windowTex }),
    residentialTeal: new THREE.MeshStandardMaterial({ color: '#d9ebe4', roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide, map: windowTex }),
    residentialWarm: new THREE.MeshStandardMaterial({ color: '#efe2c8', roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide, map: windowTex }),
    residentialBrick: new THREE.MeshStandardMaterial({ color: '#dcc0a6', roughness: 0.76, metalness: 0.06, side: THREE.DoubleSide, map: windowTex }),
  };

  for (const [key, geos] of Object.entries(wallBuckets)) {
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos, false);
    if (merged) {
      merged.computeVertexNormals();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, wallMaterials[key as keyof typeof wallBuckets]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    geos.forEach((g) => g.dispose());
  }

  const roofMaterials: Record<keyof typeof roofBuckets, THREE.MeshStandardMaterial> = {
    // Weathered corrugated zinc, as on most Myitkyina roofs
    redZinc: new THREE.MeshStandardMaterial({ color: '#9a4a3a', roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide }),
    blueZinc: new THREE.MeshStandardMaterial({ color: '#4b6f8c', roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide }),
    greenZinc: new THREE.MeshStandardMaterial({ color: '#4f7a5a', roughness: 0.62, metalness: 0.35, side: THREE.DoubleSide }),
    goldCivic: new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.32, metalness: 0.68, side: THREE.DoubleSide }),
    darkSlate: new THREE.MeshStandardMaterial({ color: '#5f6468', roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide }),
    lightZinc: new THREE.MeshStandardMaterial({ color: '#b9bdbd', roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }),
    maroonZinc: new THREE.MeshStandardMaterial({ color: '#7a2e2a', roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide }),
  };

  for (const [key, geos] of Object.entries(roofBuckets)) {
    if (geos.length === 0) continue;
    const merged = mergeGeometries(geos, false);
    if (merged) {
      merged.computeVertexNormals();
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, roofMaterials[key as keyof typeof roofBuckets]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    geos.forEach((g) => g.dispose());
  }

  // Merge OSM Road Layers (DoubleSide + frustumCulled = false so roads never vanish at any camera angle)
  if (roadTrunkGeos.length > 0) {
    const mergedTrunk = mergeGeometries(roadTrunkGeos, false);
    if (mergedTrunk) {
      mergedTrunk.computeVertexNormals();
      mergedTrunk.computeBoundingSphere();
      const trunkMesh = new THREE.Mesh(
        mergedTrunk,
        new THREE.MeshStandardMaterial({
          color: '#3a3f45',
          map: asphaltDetailTexture(),
          roughness: 0.9,
          metalness: 0.1,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -4,
        }),
      );
      trunkMesh.receiveShadow = true;
      trunkMesh.frustumCulled = false;
      group.add(trunkMesh);
    }
    roadTrunkGeos.forEach((g) => g.dispose());
  }

  if (roadCenterLineGeos.length > 0) {
    const mergedCenter = mergeGeometries(roadCenterLineGeos, false);
    if (mergedCenter) {
      mergedCenter.computeBoundingSphere();
      const lineMesh = new THREE.Mesh(
        mergedCenter,
        new THREE.MeshBasicMaterial({
          color: '#facc15',
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -6,
        }),
      );
      lineMesh.frustumCulled = false;
      group.add(lineMesh);
    }
    roadCenterLineGeos.forEach((g) => g.dispose());
  }

  if (roadResidentialGeos.length > 0) {
    const mergedRes = mergeGeometries(roadResidentialGeos, false);
    if (mergedRes) {
      mergedRes.computeVertexNormals();
      mergedRes.computeBoundingSphere();
      const resMesh = new THREE.Mesh(
        mergedRes,
        new THREE.MeshStandardMaterial({
          color: '#7d8187',
          map: (() => {
            const t = concreteDetailTexture();
            t.repeat.set(1, 3); // concrete road slabs ~3.3 m
            return t;
          })(),
          roughness: 0.9,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -3,
        }),
      );
      resMesh.receiveShadow = true;
      resMesh.frustumCulled = false;
      group.add(resMesh);
    }
    roadResidentialGeos.forEach((g) => g.dispose());
  }

  if (roadServiceGeos.length > 0) {
    const mergedSvc = mergeGeometries(roadServiceGeos, false);
    if (mergedSvc) {
      mergedSvc.computeVertexNormals();
      mergedSvc.computeBoundingSphere();
      const svcMesh = new THREE.Mesh(
        mergedSvc,
        new THREE.MeshStandardMaterial({
          color: '#9a5c37',
          map: asphaltDetailTexture(),
          roughness: 0.95,
          metalness: 0.02,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      svcMesh.receiveShadow = true;
      svcMesh.frustumCulled = false;
      group.add(svcMesh);
    }
    roadServiceGeos.forEach((g) => g.dispose());
  }

  // Sidewalks, curbs and shop signboards
  const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, shadow: boolean) => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) return;
    merged.computeVertexNormals();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = shadow;
    mesh.frustumCulled = false;
    group.add(mesh);
  };
  addMerged(
    sidewalkGeos,
    new THREE.MeshStandardMaterial({
      color: '#c8c4ba',
      map: (() => {
        const t = concreteDetailTexture();
        t.repeat.set(1, 4); // slabs ~2.5 m along the walk
        return t;
      })(),
      roughness: 0.9,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    false,
  );
  addMerged(curbGeos, new THREE.MeshStandardMaterial({ color: '#e7e5e4', roughness: 0.8, side: THREE.DoubleSide }), false);
  if (signCount > 0) {
    const signGeo = new THREE.BufferGeometry();
    signGeo.setAttribute('position', new THREE.Float32BufferAttribute(signPositions, 3));
    signGeo.setAttribute('uv', new THREE.Float32BufferAttribute(signUvs, 2));
    signGeo.computeVertexNormals();
    const signMesh = new THREE.Mesh(
      signGeo,
      new THREE.MeshStandardMaterial({ map: createShopSignAtlas(), roughness: 0.55, side: THREE.DoubleSide }),
    );
    signMesh.frustumCulled = false;
    group.add(signMesh);
  }

  // ==========================================================================
  // 4. 3D DEBUG OVERLAY GROUP (OSM BOUNDING BOX, CITY CLUSTER BEACONS & NEAREST ROAD)
  // ==========================================================================
  const debugGroup = new THREE.Group();
  debugGroup.name = 'Osm3DDebugOverlay';
  debugGroup.visible = false;

  const safeMinX = Number.isFinite(minX) ? Math.round(minX) : -856;
  const safeMaxX = Number.isFinite(maxX) ? Math.round(maxX) : 661;
  const safeMinZ = Number.isFinite(minZ) ? Math.round(minZ) : -422;
  const safeMaxZ = Number.isFinite(maxZ) ? Math.round(maxZ) : 1029;

  // Cyan 3D Wireframe Bounding Box around the OSM Building Footprint
  const bboxPts = [
    new THREE.Vector3(safeMinX, 6, safeMinZ),
    new THREE.Vector3(safeMaxX, 6, safeMinZ),
    new THREE.Vector3(safeMaxX, 6, safeMaxZ),
    new THREE.Vector3(safeMinX, 6, safeMaxZ),
    new THREE.Vector3(safeMinX, 6, safeMinZ),
    new THREE.Vector3(safeMinX, 45, safeMinZ),
    new THREE.Vector3(safeMaxX, 45, safeMinZ),
    new THREE.Vector3(safeMaxX, 45, safeMaxZ),
    new THREE.Vector3(safeMinX, 45, safeMaxZ),
    new THREE.Vector3(safeMinX, 45, safeMinZ),
  ];
  const bboxGeo = new THREE.BufferGeometry().setFromPoints(bboxPts);
  const bboxLine = new THREE.Line(
    bboxGeo,
    new THREE.LineBasicMaterial({ color: '#06b6d4' }),
  );
  bboxLine.frustumCulled = false;
  debugGroup.add(bboxLine);

  // Glowing Beacons at each Verified OSM City Spawn Point
  const beaconGeo = new THREE.CylinderGeometry(2.5, 2.5, 90, 12);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: '#facc15',
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  for (const sp of DEFAULT_OSM_CITY_SPAWNS) {
    const bMesh = new THREE.Mesh(beaconGeo, beaconMat);
    bMesh.position.set(sp.x, 45, sp.z);
    bMesh.frustumCulled = false;
    debugGroup.add(bMesh);
  }

  // Dynamic 3D Player Marker Pillar & Nearest OSM Road Line
  const playerBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 110, 12),
    new THREE.MeshBasicMaterial({
      color: '#10b981',
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  playerBeacon.frustumCulled = false;
  debugGroup.add(playerBeacon);

  const nearestRoadSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 14, 14),
    new THREE.MeshBasicMaterial({ color: '#f43f5e' }),
  );
  nearestRoadSphere.frustumCulled = false;
  debugGroup.add(nearestRoadSphere);

  const roadLinkPositions = new Float32Array(6);
  const roadLinkGeo = new THREE.BufferGeometry();
  roadLinkGeo.setAttribute('position', new THREE.BufferAttribute(roadLinkPositions, 3));
  const roadLinkLine = new THREE.Line(
    roadLinkGeo,
    new THREE.LineBasicMaterial({ color: '#f43f5e' }),
  );
  roadLinkLine.frustumCulled = false;
  debugGroup.add(roadLinkLine);

  const updateDebugOverlay = (playerX: number, playerY: number, playerZ: number) => {
    playerBeacon.position.set(playerX, playerY + 55, playerZ);

    let nearbyBuildings150m = 0;
    for (let i = 0; i < buildingCentroids.length; i++) {
      const b = buildingCentroids[i];
      if (Math.hypot(b.x - playerX, b.z - playerZ) <= 150) {
        nearbyBuildings150m++;
      }
    }

    let bestDist = Infinity;
    let bestName = 'OSM Residential Street';
    let nearX = playerX;
    let nearZ = playerZ;

    for (let i = 0; i < roadSegments.length; i++) {
      const s = roadSegments[i];
      const d = distToSegment(playerX, playerZ, s.x1, s.z1, s.x2, s.z2);
      if (d < bestDist) {
        bestDist = d;
        bestName = s.name;
        nearX = (s.x1 + s.x2) * 0.5;
        nearZ = (s.z1 + s.z2) * 0.5;
      }
    }

    const ny = groundHeightAt(nearX, nearZ) + 1.5;
    nearestRoadSphere.position.set(nearX, ny, nearZ);
    const posArr = (roadLinkGeo.attributes.position as THREE.BufferAttribute).array as Float32Array;
    posArr[0] = playerX;
    posArr[1] = playerY + 1.8;
    posArr[2] = playerZ;
    posArr[3] = nearX;
    posArr[4] = ny;
    posArr[5] = nearZ;
    roadLinkGeo.attributes.position.needsUpdate = true;

    return {
      nearbyBuildings150m,
      nearestRoadName: bestName,
      nearestRoadDistM: Number.isFinite(bestDist) ? Math.round(bestDist) : 0,
    };
  };

  return {
    group,
    debugGroup,
    updateDebugOverlay,
    buildingsCount,
    roadsCount,
    bbox: {
      minLat: Number((Number.isFinite(minLat) ? minLat : 25.3448).toFixed(4)),
      maxLat: Number((Number.isFinite(maxLat) ? maxLat : 25.4253).toFixed(4)),
      minLng: Number((Number.isFinite(minLng) ? minLng : 97.3537).toFixed(4)),
      maxLng: Number((Number.isFinite(maxLng) ? maxLng : 97.4456).toFixed(4)),
      minX: safeMinX,
      maxX: safeMaxX,
      minZ: safeMinZ,
      maxZ: safeMaxZ,
    },
    citySpawnPoints: DEFAULT_OSM_CITY_SPAWNS,
    namedPlaces,
    roadPolylines,
    buildingFootprints,
    colliders,
  };
}
