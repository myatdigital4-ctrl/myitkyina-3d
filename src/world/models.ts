import * as THREE from 'three';
import {
  MAP_PLACES,
  MYITKYINA_FAMOUS_BUILDINGS,
  MYITKYINA_ROAD_SEGMENTS,
  MYITKYINA_TRAFFIC_LIGHTS,
} from '../types/game';
import {
  BRIDGE_Z,
  bridgeDeckHeightAt,
  createContactShadowTexture,
  createKachinWeaveTexture,
  createSignboardTexture,
  groundHeightAt,
  riverCenterX,
  riverHalfWidth,
  roadWeightAt,
  waterSignedDistance,
} from './terrain';
import { OPEN_LOTS, WORLD_BOUNDS, WORLD_CENTER } from './mapData.generated';
import { asphaltDetailTexture, grassDetailTexture, planarUV } from './textures';
import {
  buildBrickWall,
  buildCircleRailing,
  buildFloodlightMast,
  buildManauGate,
  buildManauGroundDressing,
  buildKachinLonghouse,
  buildRedRoofHouse,
  buildViewingPavilion,
  MANAU_GATE,
  MANAU_SPOKE_ANGLES,
  MANAU_WALL_LOOP,
  buildManauParkGrounds,
  buildShadung,
  createRainTreeGeometries,
  MANAU_PAVED_RADIUS,
  MANAU_RING_OUTER,
} from './manauPark';
import { nearestStreetPoint, relocateLegacy, reserveLot } from './worldLayout';
import { buildSkyEV, buildThreeWheeler } from './myitkyinaVehicles';

// 1. CONTINUOUS 20KM-SCALE SITAPU QUARTER TERRAIN MESH WITH NATURAL ALLUVIAL VERTEX COLORS
export function createMyitkyinaTerrainMesh(): THREE.Mesh {
  // Covers the 3 km play area plus a 400 m ring of edge hills (~10 m per grid cell)
  const size = Math.max(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) + 800;
  const segments = Math.round(size / 10);
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  geo.translate(WORLD_CENTER.x, 0, WORLD_CENTER.z);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();

  const colDeepBed = new THREE.Color('#0c262c');
  const colSandBank = new THREE.Color('#dfbe8a');
  const colGrassLow = new THREE.Color('#34743f');
  const colGrassHigh = new THREE.Color('#255c30');
  const colManauTile = new THREE.Color('#8f8e86');
  const colRock = new THREE.Color('#57534e');
  const colSnowPeak = new THREE.Color('#cbd5e1');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    const wDist = waterSignedDistance(x, z);
    const distManau = Math.hypot(x, z);

    if (y < -0.3) {
      c.copy(colDeepBed);
    } else if (wDist < 9.0) {
      c.copy(colSandBank).lerp(colGrassLow, THREE.MathUtils.smoothstep(wDist, -2, 9.0));
    } else if (distManau < MANAU_GROUND_RADIUS + 2) {
      c.copy(colManauTile);
    } else if (y > 20) {
      c.copy(colRock).lerp(colSnowPeak, THREE.MathUtils.smoothstep(y, 24, 38));
    } else if (y > 9) {
      c.copy(colGrassHigh).lerp(colRock, THREE.MathUtils.smoothstep(y, 9, 20));
    } else {
      const noise = (Math.sin(x * 0.045) * Math.cos(z * 0.045) + 1) * 0.5;
      c.copy(colGrassLow).lerp(colGrassHigh, noise);
    }

    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Grass blades / clumps as a detail map over the vertex colors, ~4 m per tile
  const grassTex = grassDetailTexture();
  grassTex.repeat.set(size / 4, size / 4);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: grassTex,
    roughness: 0.92,
    metalness: 0.02,
    envMapIntensity: 0.4,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Animated Ayeyarwady & Myitsone Water Surface extending MeshStandardMaterial via onBeforeCompile
export function createAyeyarwadyWaterMesh(
  isSoftwareGl: boolean,
): { mesh: THREE.Mesh; updateWater: (elapsed: number) => void } {
  const size = Math.max(WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX, WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ) + 800;
  const geo = new THREE.PlaneGeometry(size, size, isSoftwareGl ? 72 : 160, isSoftwareGl ? 72 : 160);
  geo.rotateX(-Math.PI / 2);
  geo.translate(WORLD_CENTER.x, 0, WORLD_CENTER.z);

  const waterUniforms = {
    uTime: { value: 0 },
  };

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0d7a72'),
    roughness: 0.16,
    metalness: 0.12,
    clearcoat: isSoftwareGl ? 0 : 0.85,
    clearcoatRoughness: 0.15,
    transparent: true,
    opacity: 0.88,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader =
      `uniform float uTime;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        float wave1 = sin(transformed.x * 0.12 + uTime * 2.2) * 0.14;
        float wave2 = cos(transformed.z * 0.09 - uTime * 1.8) * 0.12;
        transformed.y += wave1 + wave2;
        `,
      );
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.35;
  mesh.receiveShadow = true;

  return {
    mesh,
    updateWater: (elapsed: number) => {
      waterUniforms.uTime.value = elapsed;
    },
  };
}

/** Radius of the paved Manau dance ground (m) */
export const MANAU_GROUND_RADIUS = MANAU_RING_OUTER; // paved circle + ring road

// 1. SITAPU MANAU PARK (စီတာပူ မနောကွင်း — 25.4019°N, 97.4056°E -> Center x = 0, z = 0)
export interface ManauDrumNode {
  id: string;
  x: number;
  z: number;
  activated: boolean;
  ringMesh: THREE.Mesh;
  drumGroup: THREE.Group;
}

export function createManauParkComplex(
  renderer: THREE.WebGLRenderer,
): { group: THREE.Group; drums: ManauDrumNode[] } {
  const group = new THREE.Group();
  const cx = 0;
  const cz = 0;
  const baseY = groundHeightAt(cx, cz);
  group.position.set(cx, baseY, cz);

  // Large grey paved dance ground (as in the reference photos)
  const groundGeo = new THREE.CylinderGeometry(MANAU_PAVED_RADIUS, MANAU_PAVED_RADIUS + 0.4, 0.16, 96);
  planarUV(groundGeo, 3);
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshStandardMaterial({ color: '#4a4c49', map: asphaltDetailTexture(), roughness: 0.97, metalness: 0.02, envMapIntensity: 0.25 }),
  );
  ground.position.y = 0.08;
  ground.receiveShadow = true;
  group.add(ground);

  // Manau poles on their platform, facing south (+z) toward the main approach
  // Pole base sits at the circle center; on the 19z satellite its long axis runs WSW–ENE
  // (~24° north of east), and the 360° photo shows the emblem side facing north.
  const polesAt = { x: 0, z: 3 };
  const shadung = buildShadung(renderer);
  shadung.position.set(polesAt.x, 0.16, polesAt.z);
  shadung.rotation.y = Math.PI + 0.42;
  group.add(shadung);
  group.add(buildManauGroundDressing(MANAU_PAVED_RADIUS - 1.5, 21, polesAt, { x: -20, z: 16 }));
  group.add(buildCircleRailing(MANAU_PAVED_RADIUS, MANAU_SPOKE_ANGLES, 0.16));

  // Floodlights: a tall mast in the west field and a pole by the railing to the north-east
  const mastW = buildFloodlightMast(26);
  mastW.position.set(-58, groundHeightAt(cx - 58, cz - 6) - baseY, -6);
  group.add(mastW);
  const poleNE = buildFloodlightMast(12);
  poleNE.position.set(30, 0, -32);
  group.add(poleNE);

  // Buildings north of the circle, modeled from the 360° photo
  const pavilion360 = buildViewingPavilion(28, 20); // 19z satellite: ~30 × 21 m
  pavilion360.position.set(-7, groundHeightAt(cx - 7, cz - 89) - baseY, -89);
  group.add(pavilion360);
  // Kachin longhouse NW of the circle: ~44 × 10 m, long axis ~20° off north (satellite)
  const longhouse = buildKachinLonghouse(42, 10);
  longhouse.position.set(-52, groundHeightAt(cx - 52, cz - 93) - baseY, -93);
  longhouse.rotation.y = 0.36;
  group.add(longhouse);

  const redHouse = buildRedRoofHouse(23, 16);
  redHouse.position.set(16, groundHeightAt(cx + 16, cz - 83) - baseY, -83);
  group.add(redHouse);
  // Ring road, eight paths, rain trees and the bronze statue (relative to the circle center)
  const grounds = buildManauParkGrounds((x, z) => groundHeightAt(cx + x, cz + z) - baseY);
  group.add(grounds);

  // Main entrance gate at the west end of the west path, facing out toward the street
  const gate = buildManauGate(renderer);
  gate.position.set(MANAU_GATE.x, groundHeightAt(cx + MANAU_GATE.x, cz + MANAU_GATE.z) - baseY, MANAU_GATE.z);
  gate.rotation.y = MANAU_GATE.facing;
  group.add(gate);
  // Where real streets / paths cross the wall line, the wall must open (player screenshots)
  const crossings: { x: number; z: number }[] = [];
  for (let i = 0; i < MANAU_WALL_LOOP.length - 1; i++) {
    const [ax, az] = MANAU_WALL_LOOP[i];
    const [bx, bz] = MANAU_WALL_LOOP[i + 1];
    for (const r of MYITKYINA_ROAD_SEGMENTS) {
      const x1 = r.x1 - cx, z1 = r.z1 - cz, x2 = r.x2 - cx, z2 = r.z2 - cz;
      const d = (bx - ax) * (z2 - z1) - (bz - az) * (x2 - x1);
      if (Math.abs(d) < 1e-6) continue;
      const t = ((x1 - ax) * (z2 - z1) - (z1 - az) * (x2 - x1)) / d;
      const u = ((x1 - ax) * (bz - az) - (z1 - az) * (bx - ax)) / d;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        const p = { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
        if (crossings.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > 6)) crossings.push(p);
      }
    }
  }
  // Second tusk gate on the north side: the crossing nearest where the player reported it
  const northGateAt = crossings.length
    ? crossings.reduce((a, b) => (Math.hypot(a.x - 18, a.z + 123) < Math.hypot(b.x - 18, b.z + 123) ? a : b))
    : { x: -4, z: -109 };
  const northGate = buildManauGate(renderer);
  northGate.position.set(northGateAt.x, groundHeightAt(cx + northGateAt.x, cz + northGateAt.z) - baseY, northGateAt.z);
  northGate.rotation.y = Math.atan2(northGateAt.x, northGateAt.z);
  group.add(northGate);

  // Red brick perimeter wall around the park, open at both gates and every street crossing
  group.add(
    buildBrickWall(MANAU_WALL_LOOP, (x, z) => groundHeightAt(cx + x, cz + z) - baseY, [
      { ...MANAU_GATE, half: 7 },
      { ...northGateAt, half: 7 },
      ...crossings.map((c) => ({ ...c, half: 4 })),
    ]),
  );

  const goldMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.24, metalness: 0.82 });

  // 4 Interactive Sacred Manau Drums around the spacious plaza for Quest 1
  // The four interactive drums were removed (not part of the real park)
  const drumOffsets: { id: string; dx: number; dz: number }[] = [];

  const drums: ManauDrumNode[] = [];
  const woodMat = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.65, metalness: 0.1 });
  const drumSkinMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.4, metalness: 0.05 });

  drumOffsets.forEach((d) => {
    const drumGroup = new THREE.Group();
    drumGroup.position.set(d.dx, 0.38, d.dz);

    for (const side of [-1.2, 1.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 2.8, 10), woodMat);
      post.position.set(side, 1.4, 0);
      post.castShadow = true;
      drumGroup.add(post);
    }
    const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.0, 10), goldMat);
    crossbar.rotation.z = Math.PI / 2;
    crossbar.position.y = 2.65;
    drumGroup.add(crossbar);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 1.75, 18), woodMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.y = 1.65;
    barrel.castShadow = true;
    drumGroup.add(barrel);

    const heads = new THREE.Mesh(new THREE.CylinderGeometry(0.83, 0.83, 1.8, 18), drumSkinMat);
    heads.rotation.x = Math.PI / 2;
    heads.position.y = 1.65;
    drumGroup.add(heads);

    const ringMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 0.8,
      roughness: 0.3,
    });
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.14, 10, 32), ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 0.12;
    drumGroup.add(ringMesh);

    group.add(drumGroup);
    drums.push({
      id: d.id,
      x: cx + d.dx,
      z: cz + d.dz,
      activated: false,
      ringMesh,
      drumGroup,
    });
  });

  return { group, drums };
}

// 2. BALAMINHTIN BRIDGE (ဗလမင်းထင်တံတား — 25.4244°N, 97.4253°E -> z = -362, x = 130..350)
export function createBalaminhtinBridge(): {
  group: THREE.Group;
  checkpoints: { id: string; x: number; z: number; passed: boolean; mesh: THREE.Mesh }[];
} {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: '#64748b',
    roughness: 0.35,
    metalness: 0.78,
  });
  const deckMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.85,
    metalness: 0.1,
  });
  const concreteMat = new THREE.MeshStandardMaterial({
    color: '#94a3b8',
    roughness: 0.8,
    metalness: 0.08,
  });
  const yellowLineMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#ca8a04',
    emissiveIntensity: 0.25,
    roughness: 0.4,
  });

  // Build arched steel-truss deck segments from x = 130 to x = 350 at z = BRIDGE_Z (-362)
  const segCount = 28;
  const startX = 130;
  const endX = 350;
  const stepX = (endX - startX) / segCount;

  for (let i = 0; i < segCount; i++) {
    const x0 = startX + i * stepX;
    const x1 = x0 + stepX;
    const xm = (x0 + x1) * 0.5;
    const y0 = bridgeDeckHeightAt(x0);
    const y1 = bridgeDeckHeightAt(x1);
    const ym = (y0 + y1) * 0.5;
    const angle = Math.atan2(y1 - y0, stepX);

    const segGroup = new THREE.Group();
    segGroup.position.set(xm, ym, BRIDGE_Z);
    segGroup.rotation.z = angle;

    const slab = new THREE.Mesh(new THREE.BoxGeometry(stepX + 0.3, 0.65, 14.5), deckMat);
    slab.position.y = -0.28;
    slab.receiveShadow = true;
    slab.castShadow = true;
    segGroup.add(slab);

    if (i % 2 === 0) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(stepX * 0.6, 0.06, 0.28), yellowLineMat);
      stripe.position.y = 0.05;
      segGroup.add(stripe);
    }

    for (const sideZ of [-6.8, 6.8]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(stepX + 0.2, 0.95, 0.38), concreteMat);
      rail.position.set(0, 0.48, sideZ);
      segGroup.add(rail);
    }

    if (i >= 3 && i <= 24) {
      for (const sideZ of [-6.6, 6.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 7.2, 0.45), steelMat);
        post.position.set(0, 3.6, sideZ);
        post.castShadow = true;
        segGroup.add(post);

        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 9.2, 0.3), steelMat);
        diag.position.set(0, 3.6, sideZ);
        diag.rotation.z = i % 2 === 0 ? 0.65 : -0.65;
        segGroup.add(diag);

        const topChord = new THREE.Mesh(new THREE.BoxGeometry(stepX + 0.35, 0.48, 0.48), steelMat);
        topChord.position.set(0, 7.2, sideZ);
        segGroup.add(topChord);
      }

      if (i % 2 === 0) {
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 13.6), steelMat);
        crossBeam.position.set(0, 7.2, 0);
        segGroup.add(crossBeam);
      }
    }

    group.add(segGroup);
  }

  // Heavy Concrete River Piers beneath the bridge
  const pierXs = [165, 202, 240, 278, 315];
  pierXs.forEach((px) => {
    const py = bridgeDeckHeightAt(px);
    const pier = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 2.5, py + 6, 16),
      concreteMat,
    );
    pier.position.set(px, (py - 6) * 0.5, BRIDGE_Z);
    pier.castShadow = true;
    group.add(pier);
  });

  // 3 Bridge Checkpoints for Quest 3
  const cpXs = [155, 240, 325];
  const checkpoints: { id: string; x: number; z: number; passed: boolean; mesh: THREE.Mesh }[] = [];
  cpXs.forEach((cx, idx) => {
    const cy = bridgeDeckHeightAt(cx);
    const cpMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
    });
    const cpArch = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.25, 12, 32, Math.PI), cpMat);
    cpArch.rotation.y = Math.PI / 2;
    cpArch.position.set(cx, cy + 0.2, BRIDGE_Z);
    group.add(cpArch);

    checkpoints.push({
      id: `bridge_cp_${idx}`,
      x: cx,
      z: BRIDGE_Z,
      passed: false,
      mesh: cpArch,
    });
  });

  return { group, checkpoints };
}

// 2b. STRAND ROAD RIVERSIDE CHECKPOINTS (ကမ်းနားလမ်း) — replaces the bridge gates inside the 3 km map
export function createStrandRoadCheckpoints(): {
  group: THREE.Group;
  checkpoints: { id: string; x: number; z: number; passed: boolean; mesh: THREE.Mesh }[];
} {
  const group = new THREE.Group();
  const checkpoints: { id: string; x: number; z: number; passed: boolean; mesh: THREE.Mesh }[] = [];
  [-260, 0, 260].forEach((dz, idx) => {
    const guessZ = MAP_PLACES.strandNorth.z + dz;
    const guessX = riverCenterX(guessZ) - riverHalfWidth(guessZ) - 35;
    const p = nearestStreetPoint(guessX, guessZ);
    const cpMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
    });
    const cpArch = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.25, 12, 32, Math.PI), cpMat);
    // Arch spans the road: its plane faces along the street heading
    cpArch.rotation.y = p.heading;
    cpArch.position.set(p.x, groundHeightAt(p.x, p.z) + 0.2, p.z);
    group.add(cpArch);
    checkpoints.push({ id: `strand_cp_${idx}`, x: p.x, z: p.z, passed: false, mesh: cpArch });
  });
  return { group, checkpoints };
}

export function createMyitkyinaDowntown(): THREE.Group {
  const group = new THREE.Group();
  const cx = -125;
  const cz = 335;
  const baseY = groundHeightAt(cx, cz);
  group.position.set(cx, baseY, cz);

  const creamWall = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.7 });
  const crimsonTrim = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.45 });
  const jadeRoofMat = new THREE.MeshStandardMaterial({ color: '#047857', roughness: 0.4, metalness: 0.25 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.35, metalness: 0.8 });

  // Iconic Myitkyina Clock Tower at Downtown Highway Roundabout Island
  const tower = new THREE.Group();
  const islandCurb = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.35, 20), creamWall);
  islandCurb.position.y = 0.17;
  tower.add(islandCurb);

  const towerBase = new THREE.Mesh(new THREE.BoxGeometry(3.8, 3.2, 3.8), crimsonTrim);
  towerBase.position.y = 1.6;
  towerBase.castShadow = true;
  tower.add(towerBase);

  const towerShaft = new THREE.Mesh(new THREE.BoxGeometry(2.8, 12.0, 2.8), creamWall);
  towerShaft.position.y = 3.2 + 6.0;
  towerShaft.castShadow = true;
  tower.add(towerShaft);

  const dialGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.18, 20);
  const dialMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#facc15',
    emissiveIntensity: 0.35,
  });
  for (let a = 0; a < 4; a++) {
    const dial = new THREE.Mesh(dialGeo, dialMat);
    dial.rotation.x = Math.PI / 2;
    dial.rotation.z = (a * Math.PI) / 2;
    dial.position.set(
      Math.sin((a * Math.PI) / 2) * 1.45,
      12.8,
      Math.cos((a * Math.PI) / 2) * 1.45,
    );
    tower.add(dial);
  }

  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.6, 4), jadeRoofMat);
  spire.position.y = 16.8;
  spire.rotation.y = Math.PI / 4;
  tower.add(spire);
  group.add(tower);

  // Multi-Wing Myoma Central Market Complex (မြို့မဈေးကြီး — Set back 20m North & South of rd_market_concrete)
  const marketWings = [
    { dx: 28, dz: -20, w: 15, h: 5.2, d: 8.0, roofColor: '#047857' },
    { dx: 28, dz: 20, w: 15, h: 5.6, d: 8.0, roofColor: '#b91c1c' },
    { dx: 52, dz: -20, w: 14, h: 5.4, d: 8.0, roofColor: '#1d4ed8' },
    { dx: 52, dz: 20, w: 14, h: 5.8, d: 8.0, roofColor: '#b45309' },
  ];

  marketWings.forEach((b) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(b.dx, 0, b.dz);
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), creamWall);
    body.position.y = b.h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    bGroup.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.hypot(b.w, b.d) * 0.56, 2.5, 4),
      new THREE.MeshStandardMaterial({ color: b.roofColor, roughness: 0.45, metalness: 0.2 }),
    );
    roof.position.y = b.h + 1.25;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    bGroup.add(roof);
    group.add(bGroup);
  });

  // Historic Myitkyina Railway Station Terminus & Steel Tracks (Set back South-East at dx = 56, dz = 36)
  const stationGroup = new THREE.Group();
  stationGroup.position.set(56, 0, 36);

  const stBody = new THREE.Mesh(new THREE.BoxGeometry(22, 6.0, 9.0), creamWall);
  stBody.position.set(0, 3.0, 0);
  stBody.castShadow = true;
  stationGroup.add(stBody);

  const stRoof = new THREE.Mesh(
    new THREE.ConeGeometry(16, 3.2, 4),
    new THREE.MeshStandardMaterial({ color: '#991b1b', roughness: 0.5 }),
  );
  stRoof.position.set(0, 7.6, 0);
  stRoof.rotation.y = Math.PI / 4;
  stRoof.scale.set(1.35, 1, 0.65);
  stationGroup.add(stRoof);

  // Railway Tracks extending South along the Mandalay-Myitkyina line
  const tieMat = new THREE.MeshStandardMaterial({ color: '#451a03', roughness: 0.9 });
  for (let tz = 8; tz <= 95; tz += 3.6) {
    const tie = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 0.6), tieMat);
    tie.position.set(-16, 0.08, tz);
    stationGroup.add(tie);
  }
  for (const rx of [-17.1, -14.9]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 90), darkMetal);
    rail.position.set(rx, 0.18, 52);
    stationGroup.add(rail);
  }

  // Parked Myanmar Railways Diesel-Electric Locomotive
  const locoGroup = new THREE.Group();
  locoGroup.position.set(-16, 0.2, 16);
  locoGroup.rotation.y = Math.PI / 2;
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 9.5, 16), darkMetal);
  boiler.rotation.z = Math.PI / 2;
  boiler.position.y = 2.1;
  boiler.castShadow = true;
  locoGroup.add(boiler);

  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 3.6, 3.0),
    new THREE.MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.4, metalness: 0.6 }),
  );
  cab.position.set(-4.2, 2.5, 0);
  cab.castShadow = true;
  locoGroup.add(cab);

  for (let wx = -4.2; wx <= 3.8; wx += 2.0) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 3.1, 14), crimsonTrim);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.72, 0);
    locoGroup.add(wheel);
  }
  stationGroup.add(locoGroup);
  group.add(stationGroup);

  return group;
}

// 5. MYITSONE CONFLUENCE SANCTUARY (172, -551) & JAW BUM PEACE BELL (436, -218)
export function createMyitsoneAndJawBum(): {
  group: THREE.Group;
  peaceBell: { x: number; z: number; rung: boolean; bellMesh: THREE.Mesh };
} {
  const group = new THREE.Group();

  // Myitsone Confluence Central Island Monument (x = 172, z = -551)
  const mx = 172;
  const mz = -551;
  const my = groundHeightAt(mx, mz);
  const myitsoneGroup = new THREE.Group();
  myitsoneGroup.position.set(mx, Math.max(0.6, my), mz);

  const stoneMat = new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.85 });
  const jadeMonolithMat = new THREE.MeshPhysicalMaterial({
    color: '#059669',
    roughness: 0.2,
    metalness: 0.15,
    clearcoat: 0.9,
  });

  const monolith = new THREE.Mesh(new THREE.DodecahedronGeometry(4.2, 1), jadeMonolithMat);
  monolith.scale.set(0.85, 2.3, 0.85);
  monolith.position.y = 4.2;
  monolith.castShadow = true;
  myitsoneGroup.add(monolith);

  for (let b = 0; b < 8; b++) {
    const ang = (b / 8) * Math.PI * 2;
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2 + (b % 3) * 0.7, 0), stoneMat);
    boulder.position.set(Math.cos(ang) * 10.5, 1.2, Math.sin(ang) * 10.5);
    boulder.castShadow = true;
    myitsoneGroup.add(boulder);
  }
  group.add(myitsoneGroup);

  // Jaw Bum Mountain Peace Bell Pavilion on East Bank (x = 436, z = -218)
  const jx = 436;
  const jz = -218;
  const jy = groundHeightAt(jx, jz);
  const jawGroup = new THREE.Group();
  jawGroup.position.set(jx, jy, jz);

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: '#d97706',
    roughness: 0.25,
    metalness: 0.88,
  });
  const pillarMat = new THREE.MeshStandardMaterial({
    color: '#991b1b',
    roughness: 0.55,
  });

  for (const [px, pz] of [
    [-3.4, -3.4],
    [3.4, -3.4],
    [-3.4, 3.4],
    [3.4, 3.4],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 6.2, 12), pillarMat);
    post.position.set(px, 3.1, pz);
    post.castShadow = true;
    jawGroup.add(post);
  }

  const pavRoof = new THREE.Mesh(new THREE.ConeGeometry(6.5, 3.2, 4), bronzeMat);
  pavRoof.position.y = 7.4;
  pavRoof.rotation.y = Math.PI / 4;
  pavRoof.castShadow = true;
  jawGroup.add(pavRoof);

  const bellPoints = [
    new THREE.Vector2(0, 2.5),
    new THREE.Vector2(0.65, 2.4),
    new THREE.Vector2(0.95, 1.5),
    new THREE.Vector2(1.3, 0.25),
    new THREE.Vector2(1.55, 0),
  ];
  const bellGeo = new THREE.LatheGeometry(bellPoints, 24);
  const bellMesh = new THREE.Mesh(bellGeo, bronzeMat);
  bellMesh.position.y = 2.6;
  bellMesh.castShadow = true;
  jawGroup.add(bellMesh);

  group.add(jawGroup);

  return {
    group,
    peaceBell: {
      x: jx,
      z: jz,
      rung: false,
      bellMesh,
    },
  };
}

// 6. KACHIN EXPLORER HERO CHARACTER (10-part Articulated THREE.Group with N'hpye Woven Bag & Nhtu Sword)
export interface HeroRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  bladeMesh: THREE.Mesh;
  leftFanMesh: THREE.Mesh;
  rightFanMesh: THREE.Mesh;
  fishingRodMesh: THREE.Group;
  swordSlashMesh: THREE.Mesh;
  /** Motorbike helmet, shown while riding the e-bike */
  helmetMesh: THREE.Group;
}

export function createKachinHero(renderer: THREE.WebGLRenderer): HeroRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // Grounded contact shadow disc
  const shadowTex = createContactShadowTexture();
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.04;
  group.add(shadowPlane);

  const weaveTex = createKachinWeaveTexture(renderer);
  const jacketMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.65, metalness: 0.1 });
  const weaveMat = new THREE.MeshStandardMaterial({ map: weaveTex, roughness: 0.75, metalness: 0.05 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#e2a77f', roughness: 0.55, metalness: 0.05 });
  const silverMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.9 });
  const crimsonMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.5, metalness: 0.15 });
  const manauFanMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#d97706',
    emissiveIntensity: 0.45,
    side: THREE.DoubleSide,
  });

  // ---- V2 character: rounder proportions, limbs that pivot at hips and shoulders ----
  const trouserMat = new THREE.MeshStandardMaterial({ color: '#1f2733', roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.6 });
  const soleMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#15110e', roughness: 0.75 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.3 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: '#f4efe4', roughness: 0.7 });

  /** Empty mesh used as a joint: rotating it swings everything below. */
  const joint = (x: number, y: number, z: number) => {
    const j = new THREE.Mesh();
    j.position.set(x, y, z);
    return j;
  };

  // Legs: hip joint, trouser leg, sneaker
  const makeLeg = (side: number) => {
    const hip = joint(side * 0.15, 0.95, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.62, 4, 10), trouserMat);
    thigh.position.y = -0.44;
    thigh.castShadow = true;
    hip.add(thigh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.36), shoeMat);
    shoe.position.set(0, -0.89, 0.06);
    shoe.castShadow = true;
    hip.add(shoe);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.04, 0.37), soleMat);
    sole.position.set(0, -0.95, 0.06);
    hip.add(sole);
    bodyGroup.add(hip);
    return hip;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Torso: tapered Kachin jacket over a white shirt, rows of silver studs, red trim
  const torsoGeo = new THREE.CylinderGeometry(0.36, 0.3, 0.78, 14);
  torsoGeo.scale(1, 1, 0.68);
  const torso = new THREE.Mesh(torsoGeo, jacketMat);
  torso.position.y = 1.33;
  torso.castShadow = true;
  bodyGroup.add(torso);
  const shirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.05), shirtMat);
  shirt.position.set(0, 1.36, 0.235);
  bodyGroup.add(shirt);
  for (const sx of [-0.13, 0.13]) {
    for (let k = 0; k < 5; k++) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), silverMat);
      stud.position.set(sx, 1.58 - k * 0.11, 0.235);
      bodyGroup.add(stud);
    }
  }
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.07, 14), crimsonMat);
  hem.scale.set(1, 1, 0.68);
  hem.position.y = 0.97;
  bodyGroup.add(hem);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.1, 14), trouserMat);
  belt.scale.set(1, 1, 0.7);
  belt.position.y = 0.93;
  bodyGroup.add(belt);

  // Kachin woven crossbody bag (N'hpye) with tassels
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.95, 0.5), weaveMat);
  strap.position.set(0, 1.32, 0);
  strap.rotation.z = 0.62;
  bodyGroup.add(strap);
  const bagPouch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.1), weaveMat);
  bagPouch.position.set(-0.3, 0.98, 0.2);
  bagPouch.castShadow = true;
  bodyGroup.add(bagPouch);
  for (let k = 0; k < 4; k++) {
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.16, 5), crimsonMat);
    tassel.position.set(-0.41 + k * 0.07, 0.76, 0.2);
    bodyGroup.add(tassel);
  }

  // Neck, head, hair, face
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.14, 10), skinMat);
  neck.position.y = 1.78;
  bodyGroup.add(neck);
  const headGeo = new THREE.SphereGeometry(0.25, 20, 16);
  headGeo.scale(0.95, 1.08, 1);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.y = 2.04;
  head.castShadow = true;
  bodyGroup.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.262, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
  hair.position.y = 2.07;
  hair.rotation.x = -0.25;
  bodyGroup.add(hair);
  for (const sx of [-0.085, 0.085]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), eyeMat);
    eye.position.set(sx, 2.06, 0.225);
    bodyGroup.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, 0.02), hairMat);
    brow.position.set(sx, 2.13, 0.228);
    bodyGroup.add(brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), skinMat);
  nose.position.set(0, 2.0, 0.25);
  bodyGroup.add(nose);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 10, Math.PI), new THREE.MeshStandardMaterial({ color: '#8a3b2e' }));
  smile.position.set(0, 1.94, 0.232);
  smile.rotation.z = Math.PI;
  bodyGroup.add(smile);
  // Red Kachin headband with the woven pattern and two hanging ends
  const headband = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.09, 20, 1, true), weaveMat);
  headband.position.y = 2.15;
  bodyGroup.add(headband);
  for (const dz of [0, 0.05]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), crimsonMat);
    tail.position.set(0.12 + dz, 2.02, -0.25);
    tail.rotation.z = 0.2;
    bodyGroup.add(tail);
  }

  // Arms: shoulder joint, sleeve, hand
  const makeArm = (side: number) => {
    const shoulder = joint(side * 0.42, 1.64, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.48, 4, 10), jacketMat);
    sleeve.position.y = -0.3;
    sleeve.castShadow = true;
    shoulder.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.06, 10), crimsonMat);
    cuff.position.y = -0.56;
    shoulder.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMat);
    hand.position.y = -0.66;
    shoulder.add(hand);
    bodyGroup.add(shoulder);
    return shoulder;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  void torso;

  // Glossy blue motorbike helmet with a dark visor (riding the e-bike)
  const helmetMesh = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshPhysicalMaterial({ color: '#1f5fbf', roughness: 0.25, metalness: 0.2, clearcoat: 1 }),
  );
  shell.position.y = 2.05;
  helmetMesh.add(shell);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.315, 18, 8, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.32, Math.PI * 0.22),
    new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.1, metalness: 0.6 }),
  );
  visor.position.y = 2.05;
  helmetMesh.add(visor);
  const helmetStripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.6), new THREE.MeshStandardMaterial({ color: '#f8fafc' }));
  helmetStripe.position.set(0, 2.35, 0);
  helmetMesh.add(helmetStripe);
  helmetMesh.visible = false;
  bodyGroup.add(helmetMesh);

  // Kachin Silver-Hilted Sword (Nhtu) attached to right arm
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.16), silverMat);
  blade.position.set(0, -0.35, 0.45);
  blade.rotation.x = Math.PI / 2.3;
  // V2 (relax & explore): the hero carries no sword. The mesh stays (unattached) for API compatibility.

  // Traditional Kachin Manau Ceremonial Fans (မနောယပ်တောင်) attached to left & right hands (visible during Manau Dance!)
  const fanGeo = new THREE.CircleGeometry(0.38, 12, 0, Math.PI);
  const leftFanMesh = new THREE.Mesh(fanGeo, manauFanMat);
  leftFanMesh.position.set(-0.08, -0.66, 0.22);
  leftFanMesh.visible = false;
  leftArm.add(leftFanMesh);

  const rightFanMesh = new THREE.Mesh(fanGeo, manauFanMat);
  rightFanMesh.position.set(0.08, -0.66, 0.22);
  rightFanMesh.visible = false;
  rightArm.add(rightFanMesh);

  // Traditional Kachin Bamboo Fishing Rod (ဝါးငါးမျှားတံ) attached to right hand (visible during Ayeyarwady Fishing!)
  const fishingRodMesh = new THREE.Group();
  const rodPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.045, 2.75, 8),
    new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.5 }),
  );
  rodPole.position.set(0, -0.6, 1.25);
  rodPole.rotation.x = Math.PI / 2.35;
  fishingRodMesh.add(rodPole);

  const fishingLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 1.85, 6),
    new THREE.MeshBasicMaterial({ color: '#e2e8f0', transparent: true, opacity: 0.85 }),
  );
  fishingLine.position.set(0, -1.3, 2.45);
  fishingRodMesh.add(fishingLine);
  fishingRodMesh.visible = false;
  rightArm.add(fishingRodMesh);

  // Sword Slash Arc VFX Mesh
  const slashGeo = new THREE.RingGeometry(1.2, 2.6, 24, 1, -Math.PI * 0.65, Math.PI * 1.3);
  slashGeo.rotateX(-Math.PI / 2);
  const slashMat = new THREE.MeshBasicMaterial({
    color: '#34d399',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const swordSlashMesh = new THREE.Mesh(slashGeo, slashMat);
  swordSlashMesh.position.y = 1.15;
  group.add(swordSlashMesh);

  return {
    group,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    bladeMesh: blade,
    leftFanMesh,
    rightFanMesh,
    fishingRodMesh,
    swordSlashMesh,
    helmetMesh,
  };
}

// 7. PLAYABLE VEHICLES (AIMA Electric Scooter ဘက်ထရီဆိုင်ကယ်, Off-Road 4x4 Highland Pickup, Myitkyina Tuk-Tuk, Ayeyarwady Longtail Boat)
export type PlayableVehicleType = 'ebike' | 'hilux4x4' | 'tuktuk' | 'riverboat' | 'skyev';

export interface WorldVehicle {
  id: string;
  type: PlayableVehicleType;
  /** Kachin Sky EV only: height above the ground (m), climb rate, thruster glow */
  alt?: number;
  vAlt?: number;
  glow?: THREE.MeshBasicMaterial[];
  label: string;
  group: THREE.Group;
  wheels: THREE.Object3D[];
  x: number;
  z: number;
  heading: number;
  speed: number;
}

export function createPlayableVehicle(
  id: string,
  type: PlayableVehicleType,
  x: number,
  z: number,
  heading: number,
  isSoftwareGl: boolean,
): WorldVehicle {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const tireMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.85, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.25, metalness: 0.85 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#bae6fd',
    roughness: 0.1,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.8,
    transparent: true,
    opacity: isSoftwareGl ? 0.45 : 1,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#fef9c3',
    emissive: '#fde047',
    emissiveIntensity: 1.2,
  });
  const glowMats: THREE.MeshBasicMaterial[] = [];
  group.rotation.order = 'YXZ';

  if (type === 'ebike') {
    // =========================================================================
    // MYITKYINA ELECTRIC SCOOTER (ဘက်ထရီဆိုင်ကယ် — AIMA A5 Pro & AIMA ONE)
    // Modeled directly from user's reference photos:
    // - AIMA A5 Pro: Metallic Titanium Silver-Grey apron, glossy black chest badge,
    //   twin rectangular LED headlights + 4 bright neon-yellow vertical grille bars,
    //   glossy black front mudguard, EEMAX black visor, two-up seat + passenger backrest.
    // - AIMA ONE: Pearl White body with wide horizontal LED headlamp bar & backrest.
    // =========================================================================
    const isPearlWhiteVariant = id.includes('white') || id.includes('one');
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: isPearlWhiteVariant ? '#f1f5f9' : '#8b959e',
      roughness: 0.2,
      metalness: isPearlWhiteVariant ? 0.25 : 0.68,
      clearcoat: 0.95,
      clearcoatRoughness: 0.1,
    });
    const glossBlackMat = new THREE.MeshPhysicalMaterial({
      color: '#090d16',
      roughness: 0.15,
      metalness: 0.4,
      clearcoat: 0.9,
    });
    const darkRubberMat = new THREE.MeshStandardMaterial({
      color: '#18181b',
      roughness: 0.88,
      metalness: 0.08,
    });
    const neonYellowMat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      emissive: '#eab308',
      emissiveIntensity: 0.75,
      roughness: 0.25,
    });
    const ledWhiteMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#e0f2fe',
      emissiveIntensity: 1.35,
      roughness: 0.15,
    });
    const alloyRimMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.35,
      metalness: 0.8,
    });

    // 1. Front & Rear 10-inch Scooter Wheels
    for (const wz of [0.92, -0.82]) {
      const wGroup = new THREE.Group();
      wGroup.position.set(0, 0.34, wz);
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.22, 20),
        tireMat,
      );
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.21, 0.24, 12),
        alloyRimMat,
      );
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.26, 10),
        rimMat,
      );
      hub.rotation.z = Math.PI / 2;
      wGroup.add(hub);

      group.add(wGroup);
      wheels.push(wGroup);
    }

    // 2. Front Telescopic Fork Legs & Glossy Front Mudguard Fender
    for (const fx of [-0.14, 0.14]) {
      const fork = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.04, 0.62, 10),
        darkRubberMat,
      );
      fork.position.set(fx, 0.56, 0.82);
      fork.rotation.x = -0.22;
      group.add(fork);
    }
    const frontFender = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.14, 0.48),
      isPearlWhiteVariant ? bodyMat : glossBlackMat,
    );
    frontFender.position.set(0, 0.68, 0.94);
    frontFender.rotation.x = 0.28;
    frontFender.castShadow = true;
    group.add(frontFender);

    // 3. Flat Step-Through Footboard (ခြေနင်းပြား) & Underbody Battery Deck
    const footboard = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.16, 1.15),
      darkRubberMat,
    );
    footboard.position.set(0, 0.38, 0.02);
    footboard.castShadow = true;
    group.add(footboard);

    // Side silver/grey trim strips along footboard
    const lowerSkirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.1, 1.1),
      bodyMat,
    );
    lowerSkirt.position.set(0, 0.34, 0.02);
    group.add(lowerSkirt);

    // 4. Sculpted Front Apron Shield (ရှေ့မျက်နှာစာ ကာဗာ)
    const apronGroup = new THREE.Group();
    apronGroup.position.set(0, 0.96, 0.66);
    apronGroup.rotation.x = -0.22;

    const mainApron = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.78, 0.28),
      bodyMat,
    );
    mainApron.castShadow = true;
    apronGroup.add(mainApron);

    // Glossy Black Top Chest Emblem Panel (AA AIMA logo badge)
    const chestBadge = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.2, 0.04),
      glossBlackMat,
    );
    chestBadge.position.set(0, 0.24, 0.14);
    apronGroup.add(chestBadge);

    const logoCircle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16),
      rimMat,
    );
    logoCircle.rotation.x = Math.PI / 2;
    logoCircle.position.set(0, 0.24, 0.16);
    apronGroup.add(logoCircle);

    if (!isPearlWhiteVariant) {
      // AIMA A5 PRO SIGNATURE FRONT:
      // Twin Rectangular Black-Bezel LED Headlights + 4 Vertical Neon-Yellow Grille Bars!
      const bezelBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.24, 0.05),
        glossBlackMat,
      );
      bezelBox.position.set(0, -0.18, 0.135);
      apronGroup.add(bezelBox);

      // Left & Right Rectangular LED Headlamps
      for (const lx of [-0.2, 0.2]) {
        const lamp = new THREE.Mesh(
          new THREE.BoxGeometry(0.17, 0.15, 0.04),
          ledWhiteMat,
        );
        lamp.position.set(lx, -0.18, 0.155);
        apronGroup.add(lamp);
      }

      // 4 Iconic Vertical Neon-Yellow Grille Bars in the Center
      for (const gx of [-0.066, -0.022, 0.022, 0.066]) {
        const yellowBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.026, 0.18, 0.045),
          neonYellowMat,
        );
        yellowBar.position.set(gx, -0.18, 0.158);
        apronGroup.add(yellowBar);
      }

      // Neon-yellow "A5 PRO" decal accent on left front apron
      const a5Decal = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.045, 0.02),
        neonYellowMat,
      );
      a5Decal.position.set(-0.2, -0.02, 0.145);
      apronGroup.add(a5Decal);
    } else {
      // AIMA ONE PEARL WHITE SIGNATURE FRONT:
      // Wide Full-Width Horizontal LED Headlamp Bar
      const wideBezel = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.22, 0.05),
        glossBlackMat,
      );
      wideBezel.position.set(0, -0.18, 0.135);
      apronGroup.add(wideBezel);

      const wideLed = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.14, 0.04),
        ledWhiteMat,
      );
      wideLed.position.set(0, -0.18, 0.155);
      apronGroup.add(wideLed);
    }

    group.add(apronGroup);

    // 5. Rear Body Side Fairings, Two-Up Seat & Passenger Backrest (ထိုင်ခုံနှင့် နောက်မှီ)
    const rearBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.44, 0.92),
      bodyMat,
    );
    rearBody.position.set(0, 0.66, -0.45);
    rearBody.castShadow = true;
    group.add(rearBody);

    // Neon-yellow or silver side stripe on rear body panel
    const sideAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.05, 0.55),
      isPearlWhiteVariant ? rimMat : neonYellowMat,
    );
    sideAccent.position.set(0, 0.66, -0.52);
    group.add(sideAccent);

    // Long Cushioned Two-Up Saddle Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.16, 0.92),
      darkRubberMat,
    );
    seat.position.set(0, 0.94, -0.42);
    seat.castShadow = true;
    group.add(seat);

    // Rear Passenger Backrest Pad & Grab Bracket
    const backrestSupport = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.24, 0.08),
      rimMat,
    );
    backrestSupport.position.set(0, 1.06, -0.92);
    group.add(backrestSupport);

    const backrestPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.22, 0.12),
      glossBlackMat,
    );
    backrestPad.position.set(0, 1.2, -0.92);
    backrestPad.castShadow = true;
    group.add(backrestPad);

    // Rear LED Taillight
    const tailLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.1, 0.05),
      new THREE.MeshStandardMaterial({
        color: '#ef4444',
        emissive: '#dc2626',
        emissiveIntensity: 1.1,
      }),
    );
    tailLight.position.set(0, 0.78, -0.92);
    group.add(tailLight);

    // 6. Steering Column, EEMAX Black Windscreen Visor, Handlebars & Twin Side Mirrors
    const handleGroup = new THREE.Group();
    handleGroup.position.set(0, 1.42, 0.48);

    // Glossy Black EEMAX Windscreen / Digital Meter Visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.28, 0.18),
      glossBlackMat,
    );
    visor.position.set(0, 0.06, 0.08);
    visor.rotation.x = -0.32;
    visor.castShadow = true;
    handleGroup.add(visor);

    // Handlebar Crossbar & Handgrips
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.96, 10),
      glossBlackMat,
    );
    bar.rotation.z = Math.PI / 2;
    handleGroup.add(bar);

    for (const side of [-1, 1]) {
      const grip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.044, 0.044, 0.22, 10),
        darkRubberMat,
      );
      grip.rotation.z = Math.PI / 2;
      grip.position.set(side * 0.42, 0, -0.02);
      handleGroup.add(grip);

      // Mirror stalk & rectangular rear-view mirror
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8),
        glossBlackMat,
      );
      stalk.position.set(side * 0.34, 0.14, 0);
      stalk.rotation.z = -side * 0.25;
      handleGroup.add(stalk);

      const mirrorHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.11, 0.04),
        glossBlackMat,
      );
      mirrorHead.position.set(side * 0.4, 0.26, 0);
      handleGroup.add(mirrorHead);
    }

    group.add(handleGroup);
  } else if (type === 'hilux4x4') {
    const paintMat = new THREE.MeshPhysicalMaterial({
      color: '#dc2626',
      roughness: 0.25,
      metalness: 0.7,
      clearcoat: 0.9,
    });
    const bedMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.6, metalness: 0.4 });

    // Lower Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.75, 4.8), paintMat);
    chassis.position.y = 0.85;
    chassis.castShadow = true;
    group.add(chassis);

    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 2.2), paintMat);
    cabin.position.set(0, 1.65, 0.2);
    cabin.castShadow = true;
    group.add(cabin);

    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.72, 0.12), glassMat);
    windshield.position.set(0, 1.68, 1.31);
    windshield.rotation.x = -0.25;
    group.add(windshield);

    // Cargo Bed & Rollbar
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 1.8), bedMat);
    cargo.position.set(0, 1.15, -1.4);
    group.add(cargo);

    // Headlights
    for (const hx of [-0.75, 0.75]) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.24, 0.12), headlightMat);
      lamp.position.set(hx, 0.95, 2.42);
      group.add(lamp);
    }

    // 4 Wheels
    for (const [wx, wz] of [
      [-1.18, 1.5],
      [1.18, 1.5],
      [-1.18, -1.45],
      [1.18, -1.45],
    ]) {
      const wGroup = new THREE.Group();
      wGroup.position.set(wx, 0.52, wz);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.38, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);
      group.add(wGroup);
      wheels.push(wGroup);
    }
  } else if (type === 'tuktuk') {
    // Myitkyina three-wheel motorcycle truck: red body, green canopy (2026 street photos)
    const tw = buildThreeWheeler('#c2342b', '#3f8d3c', false);
    group.add(tw.group);
    wheels.push(...tw.wheels);
  } else if (type === 'skyev') {
    const ev = buildSkyEV();
    group.rotation.order = 'YXZ';
    group.add(ev.group);
    wheels.push(...ev.wheels);
    glowMats.push(...ev.parts.glow);
  } else {
    // Ayeyarwady Longtail Riverboat (စက်လှေ)
    const hullMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.4 });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.65, 6.8), hullMat);
    hull.position.y = 0.45;
    hull.castShadow = true;
    group.add(hull);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4), trimMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.6, 4.4);
    group.add(bow);

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.14, 3.4), trimMat);
    canopy.position.set(0, 1.85, -0.2);
    group.add(canopy);
  }

  return {
    id,
    type,
    label:
      type === 'ebike'
        ? id.includes('white') || id.includes('one')
          ? 'ဘက်ထရီဆိုင်ကယ် (AIMA ONE E-Bike)'
          : 'ဘက်ထရီဆိုင်ကယ် (AIMA A5 Pro E-Bike)'
        : type === 'hilux4x4'
          ? 'ကချင်တောင်ပေါ် 4x4 ကား (Highland 4x4)'
          : type === 'tuktuk'
            ? 'မြစ်ကြီးနား သုံးဘီး ကုန်တင် (Three-Wheeler)'
            : type === 'skyev'
              ? 'ကချင်မိုးပျံ EV (Kachin Sky EV)'
              : 'ဧရာဝတီ စက်လှေ (Ayeyarwady Riverboat)',
    group,
    wheels,
    ...(type === 'skyev' ? { alt: 0, vAlt: 0, glow: glowMats } : {}),
    x,
    z,
    heading,
    speed: 0,
  };
}

// 8. COLLECTIBLE IMPERIAL JADE CRYSTALS (စီတာပူနှင့် မြစ်ကြီးနားတစ်ခွင်ရှိ ကျောက်စိမ်းတုံးများ)
export interface JadeNode {
  id: string;
  x: number;
  z: number;
  collected: boolean;
  group: THREE.Group;
}

export function createJadeCollectibles(isSoftwareGl: boolean): JadeNode[] {
  const jadeCoords = [
    [-28, -18],
    [32, -18],
    [-62, 65],
    [55, -95],
    [150, 0],
    [-162, -50],
    [45, 115],
    [-38, -250],
    [115, -362],
    [172, -520],
    [68, 198],
    [-125, 310],
  ].map(([x, z]) => {
    // Spread the old layout over the real town and set each crystal on a street
    const p = relocateLegacy(x, z);
    return [p.x, p.z];
  });

  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: '#10b981',
    emissive: '#059669',
    emissiveIntensity: 0.45,
    roughness: 0.12,
    metalness: 0.1,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.85 : 1,
    clearcoat: 1.0,
  });
  const baseMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });

  return jadeCoords.map(([x, z], idx) => {
    const group = new THREE.Group();
    const y = groundHeightAt(x, z);
    group.position.set(x, Math.max(0.4, y), z);

    const rockBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 0.38, 7), baseMat);
    rockBase.position.y = 0.19;
    group.add(rockBase);

    for (let s = 0; s < 3; s++) {
      const spire = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62 - s * 0.1, 0),
        crystalMat,
      );
      spire.scale.set(0.7, 1.85, 0.7);
      spire.position.set((s - 1) * 0.38, 1.15 - s * 0.15, (s % 2) * 0.22);
      spire.rotation.z = (s - 1) * 0.22;
      group.add(spire);
    }

    return {
      id: `jade_${idx}`,
      x,
      z,
      collected: false,
      group,
    };
  });
}

// 9. ROGUE JADE SMUGGLERS / ENEMY HAZARDS
export interface SmugglerEnemy {
  id: string;
  x: number;
  z: number;
  homeX: number;
  homeZ: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  state: 'patrol' | 'windup' | 'lunge' | 'cooldown';
  stateTimer: number;
  hitFlashTimer: number;
  heading: number;
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  telegraphRing: THREE.Mesh;
}

export function createSmugglerEnemies(): SmugglerEnemy[] {
  // Smugglers hide along the west riverbank south of the pagoda, away from the scenic ride
  const smugglerSpots = Array.from({ length: 8 }, (_, i) => {
    const z = MAP_PLACES.strandSouth.z + 40 + i * 70;
    const x = riverCenterX(z) - riverHalfWidth(z) - 22 - (i % 3) * 14;
    return [Math.round(x), z];
  });

  const armorMat = new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.45, metalness: 0.65 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 0.9,
  });

  return smugglerSpots.map(([x, z], idx) => {
    const group = new THREE.Group();
    const y = groundHeightAt(x, z);
    group.position.set(x, Math.max(0.5, y), z);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#7f1d1d',
      roughness: 0.55,
      metalness: 0.25,
    });
    const bodyMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.9, 4, 10), bodyMat);
    bodyMesh.position.y = 1.05;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const shoulderPad = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 0.65), armorMat);
    shoulderPad.position.y = 1.45;
    group.add(shoulderPad);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.35), visorMat);
    visor.position.set(0, 1.65, 0.32);
    group.add(visor);

    const teleMat = new THREE.MeshBasicMaterial({
      color: '#ef4444',
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const telegraphRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 2.8, 24), teleMat);
    telegraphRing.rotation.x = -Math.PI / 2;
    telegraphRing.position.y = 0.08;
    group.add(telegraphRing);

    return {
      id: `smuggler_${idx}`,
      x,
      z,
      homeX: x,
      homeZ: z,
      hp: 100,
      maxHp: 100,
      alive: true,
      state: 'patrol',
      stateTimer: Math.random() * 2,
      hitFlashTimer: 0,
      heading: 0,
      group,
      bodyMesh,
      telegraphRing,
    };
  });
}

// 10. MINI-3D LAYERED TREES (သစ်ပင်များ) & RIVER ROCKS (THREE.InstancedMesh) ACROSS SPACIOUS SITAPU
export function createInstancedFoliageAndRocks(scene: THREE.Scene) {
  const treeCount = 2400; // leafy like the reference: more shade trees on the open plots
  // Broad tropical canopies (rain trees, mango, tamarind) rather than conifers
  const rain = createRainTreeGeometries();
  const trunkGeo = rain.trunk;
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.9 });
  const canopyBottomGeo = rain.canopy;
  // A small second layer keeps the old two-mesh setup; scaled to nothing visible
  const canopyTopGeo = new THREE.IcosahedronGeometry(0.01, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const canopyBottomInst = new THREE.InstancedMesh(canopyBottomGeo, canopyMat, treeCount);
  const canopyTopInst = new THREE.InstancedMesh(canopyTopGeo, canopyMat, treeCount);
  trunkInst.castShadow = true;
  canopyBottomInst.castShadow = true;
  canopyBottomInst.receiveShadow = true;
  canopyTopInst.castShadow = true;
  canopyTopInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const foliagePalette = ['#3f6b2a', '#4a7a30', '#355e26', '#56823a', '#5f7f35'];

  let placed = 0;
  let attempts = 0;
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Trees go on real empty plots (OPEN_LOTS are clear of OSM buildings and streets),
  // so the town reads as leafy compounds between houses rather than bare grass.
  const pagodaX = MAP_PLACES.pagodaJetty.x - 30;
  const pagodaZ = MAP_PLACES.pagodaJetty.z;
  while (placed < treeCount && attempts < 20000) {
    attempts++;
    const lot = OPEN_LOTS[Math.floor(rand() * OPEN_LOTS.length)];
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * Math.max(0, lot.r - 5);
    const x = lot.x + Math.cos(a) * rr;
    const z = lot.z + Math.sin(a) * rr;
    const isSitapuTree = rand() < 0.5;

    if (waterSignedDistance(x, z) < 11) continue;
    if (roadWeightAt(x, z) > 0.05) continue;
    if (Math.hypot(x, z) < 60) continue; // Manau plaza
    if (Math.hypot(x - pagodaX, z - pagodaZ) < 30) continue; // Pagoda courtyard
    if (
      MYITKYINA_FAMOUS_BUILDINGS.some(
        (b) => Math.hypot(x - b.x, z - b.z) < Math.max(b.width, b.depth) * 0.9,
      )
    ) {
      continue;
    }

    const y = groundHeightAt(x, z);
    const scale = isSitapuTree ? 0.5 + rand() * 0.25 : 0.6 + rand() * 0.35;
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale * (0.92 + rand() * 0.22), scale);
    dummy.updateMatrix();

    trunkInst.setMatrixAt(placed, dummy.matrix);
    canopyBottomInst.setMatrixAt(placed, dummy.matrix);
    canopyTopInst.setMatrixAt(placed, dummy.matrix);

    color.set(foliagePalette[placed % foliagePalette.length]);
    canopyBottomInst.setColorAt(placed, color);
    color.offsetHSL(0, 0.05, 0.06);
    canopyTopInst.setColorAt(placed, color);
    placed++;
  }

  trunkInst.instanceMatrix.needsUpdate = true;
  canopyBottomInst.instanceMatrix.needsUpdate = true;
  canopyTopInst.instanceMatrix.needsUpdate = true;
  if (canopyBottomInst.instanceColor) canopyBottomInst.instanceColor.needsUpdate = true;
  if (canopyTopInst.instanceColor) canopyTopInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyBottomInst.computeBoundingSphere();
  canopyTopInst.computeBoundingSphere();

  scene.add(trunkInst);
  scene.add(canopyBottomInst);
  scene.add(canopyTopInst);

  // Instanced Riverbank Boulders (130 rocks along Ayeyarwady & Myitsone)
  const rockCount = 130;
  const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, metalness: 0.08 });
  const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  rockInst.castShadow = true;
  rockInst.receiveShadow = true;

  let rPlaced = 0;
  while (rPlaced < rockCount) {
    const z = WORLD_BOUNDS.minZ + rand() * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
    const wSign = rand() > 0.5 ? 1 : -1;
    const x = riverCenterX(z) + wSign * (riverHalfWidth(z) + 4 + rand() * 14);
    const y = groundHeightAt(x, z);

    dummy.position.set(x, y + 0.2, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(0.85 + rand() * 1.2, 0.5 + rand() * 0.75, 0.85 + rand() * 1.2);
    dummy.updateMatrix();
    rockInst.setMatrixAt(rPlaced, dummy.matrix);

    color.set(rPlaced % 2 === 0 ? '#64748b' : '#78716c');
    rockInst.setColorAt(rPlaced, color);
    rPlaced++;
  }
  rockInst.instanceMatrix.needsUpdate = true;
  if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
  rockInst.computeBoundingSphere();
  scene.add(rockInst);
}

// ============================================================================
// 11. REALISTIC MULTI-SURFACE SITAPU ROADS (ASPHALT, CONCRETE, RED LATERITE DIRT, RIVERSIDE SAND),
//     TRADITIONAL KACHIN COMPOUNDS (ခြံဝန်းများ) & WORKING 3D TRAFFIC LIGHTS
// ============================================================================
export function createMini3DRoadsAndTrafficLights(): {
  group: THREE.Group;
  roadMaterials: THREE.MeshStandardMaterial[];
  updateTrafficLights: (elapsed: number) => void;
} {
  const group = new THREE.Group();

  // Road Surface Materials
  const asphaltMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.82,
    metalness: 0.08,
  });
  const concreteRoadMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.76,
    metalness: 0.05,
  });
  const concreteJointMat = new THREE.MeshBasicMaterial({ color: '#475569' });
  const lateriteRutMat = new THREE.MeshStandardMaterial({
    color: '#7c3f1d',
    roughness: 0.95,
    metalness: 0.02,
  });
  const lateriteStoneMat = new THREE.MeshStandardMaterial({
    color: '#a8582b',
    roughness: 0.92,
  });
  const woodPostMat = new THREE.MeshStandardMaterial({
    color: '#5c3418',
    roughness: 0.88,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: '#a38f4c',
    roughness: 0.8,
  });
  const yellowLineMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
  const whiteLineMat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });

  // Helper: Builds a subdivided road ribbon that hugs groundHeightAt(wx, wz) at every vertex (NEVER floats in mid-air on hills!)
  const createTerrainRibbon = (
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    width: number,
    yOffset: number,
    mat: THREE.Material,
    lateralOffset = 0,
  ): THREE.Mesh => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.max(1, Math.hypot(dx, dz));
    const steps = Math.max(2, Math.ceil(len / 4.0));
    const fwdX = dx / len;
    const fwdZ = dz / len;
    const rightX = -fwdZ;
    const rightZ = fwdX;
    const halfW = width * 0.5;

    const positions = new Float32Array((steps + 1) * 2 * 3);
    const normals = new Float32Array((steps + 1) * 2 * 3);
    const uvs = new Float32Array((steps + 1) * 2 * 2);
    const indices: number[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x1 + dx * t + rightX * lateralOffset;
      const cz = z1 + dz * t + rightZ * lateralOffset;

      const lx = cx - rightX * halfW;
      const lz = cz - rightZ * halfW;
      const ly = groundHeightAt(lx, lz) + yOffset;

      const rx = cx + rightX * halfW;
      const rz = cz + rightZ * halfW;
      const ry = groundHeightAt(rx, rz) + yOffset;

      const vIdx = i * 2 * 3;
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

      const uIdx = i * 2 * 2;
      uvs[uIdx] = 0;
      uvs[uIdx + 1] = t * (len / 10);
      uvs[uIdx + 2] = 1;
      uvs[uIdx + 3] = t * (len / 10);

      if (i < steps) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  };

  // A. Render Authentic Multi-Surface Road Details per Segment (100% Terrain-Conforming — Never Floats on Hills!)
  // Real OSM streets are drawn as merged ribbons by osm3dBuilder (thousands of segments);
  // per-segment dashes/joints/stones here would mean thousands of draw calls, so skip them.
  const DETAILED_ROAD_SEGMENTS: typeof MYITKYINA_ROAD_SEGMENTS = [];
  DETAILED_ROAD_SEGMENTS.forEach((seg, segIdx) => {
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const length = Math.max(1, Math.hypot(dx, dz));
    const fwdX = dx / length;
    const fwdZ = dz / length;
    const rightX = -fwdZ;
    const rightZ = fwdX;
    const angleY = Math.atan2(dx, dz);

    if (seg.surface === 'asphalt') {
      // 1. Primary Arterial Highway (ကတ္တရာလမ်းမကြီး)
      const asphaltRibbon = createTerrainRibbon(
        seg.x1,
        seg.z1,
        seg.x2,
        seg.z2,
        seg.width,
        0.03,
        asphaltMat,
      );
      group.add(asphaltRibbon);

      // Dashed Yellow Highway Centerline snapped to terrain height at each dash
      const dashStep = 9.0;
      const dashCount = Math.floor(length / dashStep);
      for (let d = 0; d < dashCount; d++) {
        const dist = (d + 0.5) * dashStep;
        const wx = seg.x1 + fwdX * dist;
        const wz = seg.z1 + fwdZ * dist;
        const wy = groundHeightAt(wx, wz) + 0.055;
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.02, 3.6), yellowLineMat);
        dash.position.set(wx, wy, wz);
        dash.rotation.y = angleY;
        group.add(dash);
      }
    } else if (seg.surface === 'concrete') {
      // 2. Sitapu Collector Concrete Street (စီတာပူ ကွန်ကရစ်လမ်းမ)
      const concreteRibbon = createTerrainRibbon(
        seg.x1,
        seg.z1,
        seg.x2,
        seg.z2,
        seg.width,
        0.028,
        concreteRoadMat,
      );
      group.add(concreteRibbon);

      // Concrete slab expansion joints every 7.5 meters snapped to terrain height
      const jointStep = 7.5;
      const jointCount = Math.floor(length / jointStep);
      for (let j = 1; j < jointCount; j++) {
        const dist = j * jointStep;
        const wx = seg.x1 + fwdX * dist;
        const wz = seg.z1 + fwdZ * dist;
        const wy = groundHeightAt(wx, wz) + 0.048;
        const joint = new THREE.Mesh(
          new THREE.BoxGeometry(seg.width * 0.96, 0.015, 0.14),
          concreteJointMat,
        );
        joint.position.set(wx, wy, wz);
        joint.rotation.y = angleY;
        group.add(joint);
      }
    } else if (seg.surface === 'laterite_dirt') {
      // 3. Authentic Sitapu Kachin Red-Earth / Gravel Lane (စီတာပူ မြေနီလမ်း — Terrain-Conforming Wheel Tracks)
      const rutOffset = seg.width * 0.22;
      for (const sideLat of [-rutOffset, rutOffset]) {
        const rutRibbon = createTerrainRibbon(
          seg.x1,
          seg.z1,
          seg.x2,
          seg.z2,
          0.85,
          0.022,
          lateriteRutMat,
          sideLat,
        );
        group.add(rutRibbon);
      }

      // Roadside laterite pebbles snapped to exact ground height
      const pebbleStep = 18;
      const pebbleCount = Math.floor(length / pebbleStep);
      for (let p = 0; p < pebbleCount; p++) {
        const dist = (p + 0.4) * pebbleStep;
        const side = (p + segIdx) % 2 === 0 ? 1 : -1;
        const lat = side * (seg.width * 0.52 + 0.5);
        const wx = seg.x1 + fwdX * dist + rightX * lat;
        const wz = seg.z1 + fwdZ * dist + rightZ * lat;
        const wy = groundHeightAt(wx, wz) + 0.12;
        const stone = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.32, 0),
          lateriteStoneMat,
        );
        stone.position.set(wx, wy, wz);
        stone.scale.set(1.2, 0.55, 1.0);
        group.add(stone);
      }

      // Wooden Kachin Ward Street Signpost snapped to exact ground height
      const signDist = Math.min(8, length * 0.12);
      const signLat = seg.width * 0.55 + 1.0;
      const sx = seg.x1 + fwdX * signDist + rightX * signLat;
      const sz = seg.z1 + fwdZ * signDist + rightZ * signLat;
      const sy = groundHeightAt(sx, sz);
      const signPost = new THREE.Group();
      signPost.position.set(sx, sy, sz);
      signPost.rotation.y = angleY;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 2.6, 8), woodPostMat);
      post.position.y = 1.3;
      post.castShadow = true;
      signPost.add(post);
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.48, 0.14), bambooMat);
      board.position.set(-0.4, 2.25, 0);
      board.castShadow = true;
      signPost.add(board);
      group.add(signPost);
    } else {
      // 4. Ayeyarwady Riverside Sand Trail (မြစ်ကမ်းဘေး သဲမြေလမ်း — Bamboo Bollards snapped to ground)
      const bollardStep = 24;
      const bollardCount = Math.floor(length / bollardStep);
      for (let b = 0; b < bollardCount; b++) {
        const dist = (b + 0.5) * bollardStep;
        const lat = seg.width * 0.5 + 0.6;
        const bx = seg.x1 + fwdX * dist + rightX * lat;
        const bz = seg.z1 + fwdZ * dist + rightZ * lat;
        const by = groundHeightAt(bx, bz);
        const bollard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.16, 1.1, 8),
          bambooMat,
        );
        bollard.position.set(bx, by + 0.55, bz);
        bollard.castShadow = true;
        group.add(bollard);
      }
    }
  });

  // B. Spacious Sitapu Quarter Traditional Kachin Compounds & Green Lawns (စီတာပူ ရိုးရာခြံဝန်းများ၊ သစ်သားခြံစည်းရိုးနှင့် မြက်ခင်းပြင်များ)
  const turfMat = new THREE.MeshStandardMaterial({
    color: '#22c55e',
    roughness: 0.78,
    metalness: 0.04,
  });
  const hedgeMat = new THREE.MeshStandardMaterial({
    color: '#15803d',
    roughness: 0.78,
  });
  const stiltHouseWallMat = new THREE.MeshStandardMaterial({
    color: '#9a5b32',
    roughness: 0.82,
  });
  const thatchRoofMat = new THREE.MeshStandardMaterial({
    color: '#78350f',
    roughness: 0.88,
  });
  const tinRoofColors = ['#991b1b', '#047857', '#1d4ed8', '#b45309'];
  const flowerColors = ['#f43f5e', '#facc15', '#ec4899', '#fb923c'];

  // Generously spaced compounds inside Sitapu city blocks (100% clear of all roads and famous buildings!)
  const sitapuCompounds = [
    // Sitapu North-West Block (Between Manau Park & Amber Palace, clear of z = -95 and z = -160)
    { x: -55, z: -128, w: 22, d: 18, hasHouse: true, roofIdx: 2 },
    { x: -158, z: -128, w: 22, d: 18, hasHouse: true, roofIdx: 3 },
    // Sitapu West Block (Between Baptist Dirt Lane z = -50 and South Lane z = 65)
    { x: -162, z: 18, w: 22, d: 18, hasHouse: true, roofIdx: 0 },
    { x: -72, z: -22, w: 20, d: 16, hasHouse: false, roofIdx: 1 },
    // Sitapu East Block (Between Manau Park & East Dirt Lane x = 95, clear of z = 0)
    { x: 58, z: -38, w: 22, d: 18, hasHouse: true, roofIdx: 1 },
    { x: 58, z: 34, w: 22, d: 18, hasHouse: false, roofIdx: 2 },
    // Sitapu South Block (South of Weaving Lane z = 115, North of Wun Tawp Lane z = 190)
    { x: -45, z: 148, w: 22, d: 18, hasHouse: true, roofIdx: 3 },
    // University Campus Green Quadrangle Lawns (Between z = -250 and z = -160)
    { x: -45, z: -205, w: 26, d: 20, hasHouse: false, roofIdx: 1 },
    { x: 35, z: -205, w: 26, d: 20, hasHouse: false, roofIdx: 2 },
  ];

  // Hand-placed compounds would overlap real OSM houses at 1:1 scale; trees fill empty plots instead.
  ([] as typeof sitapuCompounds).forEach((comp, idx) => {
    const cGroup = new THREE.Group();
    const cy = groundHeightAt(comp.x, comp.z);
    cGroup.position.set(comp.x, cy, comp.z);

    // Lush green compound lawn pad (flush with ground)
    const lawn = new THREE.Mesh(
      new THREE.BoxGeometry(comp.w, 0.08, comp.d),
      turfMat,
    );
    lawn.position.y = 0.04;
    lawn.receiveShadow = true;
    cGroup.add(lawn);

    // Traditional Kachin Wooden/Bamboo Compound Fence (ခြံစည်းရိုး) with open front gate
    const halfW = comp.w * 0.5;
    const halfD = comp.d * 0.5;
    // Back fence rail
    const backRail = new THREE.Mesh(new THREE.BoxGeometry(comp.w, 0.9, 0.18), bambooMat);
    backRail.position.set(0, 0.5, -halfD);
    backRail.castShadow = true;
    cGroup.add(backRail);
    // Left & Right fence rails
    for (const sideX of [-halfW, halfW]) {
      const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, comp.d), bambooMat);
      sideRail.position.set(sideX, 0.5, 0);
      sideRail.castShadow = true;
      cGroup.add(sideRail);
    }

    // Traditional Kachin Stilt House inside the compound yard
    if (comp.hasHouse) {
      const houseGroup = new THREE.Group();
      houseGroup.position.set(0, 0, -1.5);

      // Wooden stilts
      for (const [sx, sz] of [
        [-3.6, -2.6],
        [3.6, -2.6],
        [-3.6, 2.6],
        [3.6, 2.6],
      ]) {
        const stilt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.2, 1.2, 8),
          woodPostMat,
        );
        stilt.position.set(sx, 0.6, sz);
        houseGroup.add(stilt);
      }

      // Elevated wooden house body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 3.4, 6.5),
        stiltHouseWallMat,
      );
      body.position.y = 1.2 + 1.7;
      body.castShadow = true;
      body.receiveShadow = true;
      houseGroup.add(body);

      // Gabled roof
      const roofMat =
        idx % 2 === 0
          ? thatchRoofMat
          : new THREE.MeshStandardMaterial({
              color: tinRoofColors[comp.roofIdx % tinRoofColors.length],
              roughness: 0.55,
            });
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.6, 4), roofMat);
      roof.position.y = 1.2 + 3.4 + 1.3;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      houseGroup.add(roof);

      cGroup.add(houseGroup);
    }

    // Corner flower bushes inside the yard
    const flowerMat = new THREE.MeshStandardMaterial({
      color: flowerColors[idx % flowerColors.length],
      roughness: 0.5,
    });
    for (const [bx, bz] of [
      [-halfW + 2.2, halfD - 2.2],
      [halfW - 2.2, halfD - 2.2],
    ]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 10), hedgeMat);
      bush.position.set(bx, 0.65, bz);
      bush.scale.set(1.1, 0.8, 1.1);
      bush.castShadow = true;
      cGroup.add(bush);

      const blossom = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), flowerMat);
      blossom.position.set(bx, 1.15, bz);
      cGroup.add(blossom);
    }

    group.add(cGroup);
  });

  // C. Working 3D Traffic Lights (မီးပွိုင့်များ) ONLY at the 4 Main Highway / Concrete Intersections
  const poleMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.35,
    metalness: 0.8,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: '#090d16',
    roughness: 0.4,
    metalness: 0.5,
  });

  const signalControllers: {
    nsRed: THREE.MeshStandardMaterial;
    nsYellow: THREE.MeshStandardMaterial;
    nsGreen: THREE.MeshStandardMaterial;
    ewRed: THREE.MeshStandardMaterial;
    ewYellow: THREE.MeshStandardMaterial;
    ewGreen: THREE.MeshStandardMaterial;
    phaseOffset: number;
  }[] = [];

  MYITKYINA_TRAFFIC_LIGHTS.forEach((tl, idx) => {
    const tlGroup = new THREE.Group();
    const ty = groundHeightAt(tl.x, tl.z);
    tlGroup.position.set(tl.x, ty, tl.z);

    // 4 White Zebra Crosswalk Stripes around the main intersection
    for (const [ox, oz, rotY] of [
      [0, -7.2, 0],
      [0, 7.2, 0],
      [-7.2, 0, Math.PI / 2],
      [7.2, 0, Math.PI / 2],
    ]) {
      const cwGroup = new THREE.Group();
      cwGroup.position.set(ox, 0.05, oz);
      cwGroup.rotation.y = rotY;
      for (let s = -2; s <= 2; s++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.02, 2.6), whiteLineMat);
        bar.position.x = s * 1.25;
        cwGroup.add(bar);
      }
      tlGroup.add(cwGroup);
    }

    const nsRed = new THREE.MeshStandardMaterial({ color: '#450a0a', emissive: '#ef4444', emissiveIntensity: 0 });
    const nsYellow = new THREE.MeshStandardMaterial({ color: '#422006', emissive: '#facc15', emissiveIntensity: 0 });
    const nsGreen = new THREE.MeshStandardMaterial({ color: '#052e16', emissive: '#22c55e', emissiveIntensity: 1.8 });

    const ewRed = new THREE.MeshStandardMaterial({ color: '#450a0a', emissive: '#ef4444', emissiveIntensity: 1.8 });
    const ewYellow = new THREE.MeshStandardMaterial({ color: '#422006', emissive: '#facc15', emissiveIntensity: 0 });
    const ewGreen = new THREE.MeshStandardMaterial({ color: '#052e16', emissive: '#22c55e', emissiveIntensity: 0 });

    for (const [cornerSign, isEW] of [
      [1, false],
      [-1, true],
    ] as [number, boolean][]) {
      const postGroup = new THREE.Group();
      postGroup.position.set(cornerSign * 6.5, 0, cornerSign * 6.5);
      if (isEW) postGroup.rotation.y = Math.PI / 2;

      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 6.6, 10), poleMat);
      pole.position.y = 3.3;
      pole.castShadow = true;
      postGroup.add(pole);

      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.6, 8), poleMat);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(-cornerSign * 2.2, 6.1, 0);
      postGroup.add(arm);

      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.95, 0.58), housingMat);
      box.position.set(-cornerSign * 3.7, 5.7, 0);
      postGroup.add(box);

      const mats = isEW ? [ewRed, ewYellow, ewGreen] : [nsRed, nsYellow, nsGreen];
      const yOffsets = [0.58, 0, -0.58];
      mats.forEach((m, bIdx) => {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), m);
        bulb.scale.set(1, 1, 1.35);
        bulb.position.set(-cornerSign * 3.7, 5.7 + yOffsets[bIdx], 0);
        postGroup.add(bulb);
      });

      tlGroup.add(postGroup);
    }

    signalControllers.push({
      nsRed,
      nsYellow,
      nsGreen,
      ewRed,
      ewYellow,
      ewGreen,
      phaseOffset: idx * 2.3,
    });

    group.add(tlGroup);
  });

  const updateTrafficLights = (elapsed: number) => {
    for (let i = 0; i < signalControllers.length; i++) {
      const sc = signalControllers[i];
      const t = (elapsed + sc.phaseOffset) % 14.0;

      if (t < 5.2) {
        sc.nsGreen.emissiveIntensity = 2.0;
        sc.nsYellow.emissiveIntensity = 0.05;
        sc.nsRed.emissiveIntensity = 0.05;
        sc.ewGreen.emissiveIntensity = 0.05;
        sc.ewYellow.emissiveIntensity = 0.05;
        sc.ewRed.emissiveIntensity = 2.0;
      } else if (t < 7.0) {
        sc.nsGreen.emissiveIntensity = 0.05;
        sc.nsYellow.emissiveIntensity = 2.2;
        sc.nsRed.emissiveIntensity = 0.05;
        sc.ewGreen.emissiveIntensity = 0.05;
        sc.ewYellow.emissiveIntensity = 0.05;
        sc.ewRed.emissiveIntensity = 2.0;
      } else if (t < 12.2) {
        sc.nsGreen.emissiveIntensity = 0.05;
        sc.nsYellow.emissiveIntensity = 0.05;
        sc.nsRed.emissiveIntensity = 2.0;
        sc.ewGreen.emissiveIntensity = 2.0;
        sc.ewYellow.emissiveIntensity = 0.05;
        sc.ewRed.emissiveIntensity = 0.05;
      } else {
        sc.nsGreen.emissiveIntensity = 0.05;
        sc.nsYellow.emissiveIntensity = 0.05;
        sc.nsRed.emissiveIntensity = 2.0;
        sc.ewGreen.emissiveIntensity = 0.05;
        sc.ewYellow.emissiveIntensity = 2.2;
        sc.ewRed.emissiveIntensity = 0.05;
      }
    }
  };

  return { group, roadMaterials: [asphaltMat, concreteRoadMat], updateTrafficLights };
}

// 12. FAMOUS SITAPU & MYITKYINA BUILDINGS, SHOPS, RESTAURANTS, HOTELS & UNIVERSITY WITH 3D SIGNBOARDS
export function createFamousMyitkyinaBuildings(
  renderer: THREE.WebGLRenderer,
): THREE.Group {
  const root = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.72, metalness: 0.06 });
  const glassWindowMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    emissive: '#0284c7',
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.8,
  });
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.5 });

  MYITKYINA_FAMOUS_BUILDINGS.forEach((b) => {
    const bGroup = new THREE.Group();
    const by = groundHeightAt(b.x, b.z);
    bGroup.position.set(b.x, by, b.z);

    const roofMat = new THREE.MeshStandardMaterial({
      color: b.color,
      roughness: 0.42,
      metalness: 0.25,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: b.accentColor,
      roughness: 0.35,
      metalness: 0.4,
    });

    // Dedicated Building Plot Foundation Pad (clearly separates building compound from the road)
    const plotPad = new THREE.Mesh(
      new THREE.BoxGeometry(b.width + 4.5, 0.16, b.depth + 4.5),
      pillarMat,
    );
    plotPad.position.y = 0.08;
    plotPad.receiveShadow = true;
    bGroup.add(plotPad);

    if (b.roofShape === 'courtyard') {
      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(5.0, b.height, b.depth), wallMat);
      leftWing.position.set(-b.width / 2 + 2.5, b.height / 2, 0);
      leftWing.castShadow = true;
      bGroup.add(leftWing);

      const rightWing = new THREE.Mesh(new THREE.BoxGeometry(5.0, b.height, b.depth), wallMat);
      rightWing.position.set(b.width / 2 - 2.5, b.height / 2, 0);
      rightWing.castShadow = true;
      bGroup.add(rightWing);

      const backWing = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height + 1.6, 5.2), wallMat);
      backWing.position.set(0, (b.height + 1.6) / 2, -b.depth / 2 + 2.6);
      backWing.castShadow = true;
      bGroup.add(backWing);

      const poolMesh = new THREE.Mesh(
        new THREE.BoxGeometry(b.width - 10.5, 0.3, b.depth - 6.5),
        new THREE.MeshStandardMaterial({
          color: '#06b6d4',
          emissive: '#0891b2',
          emissiveIntensity: 0.45,
          roughness: 0.1,
        }),
      );
      poolMesh.position.set(0, 0.18, 1.6);
      bGroup.add(poolMesh);

      const topRoof = new THREE.Mesh(new THREE.BoxGeometry(b.width + 0.8, 0.85, 5.6), roofMat);
      topRoof.position.set(0, b.height + 2.0, -b.depth / 2 + 2.6);
      bGroup.add(topRoof);
    } else if (b.roofShape === 'colonnade') {
      const mainBody = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, b.depth), wallMat);
      mainBody.position.y = b.height / 2;
      mainBody.castShadow = true;
      bGroup.add(mainBody);

      for (let px = -b.width * 0.4; px <= b.width * 0.4; px += b.width * 0.16) {
        const col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.52, b.height, 12),
          pillarMat,
        );
        col.position.set(px, b.height / 2, b.depth / 2 + 0.7);
        col.castShadow = true;
        bGroup.add(col);
      }

      for (const sideX of [-b.width * 0.68, b.width * 0.68]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(6.5, 7.5, 12.0), wallMat);
        wing.position.set(sideX, 3.75, 0);
        wing.castShadow = true;
        bGroup.add(wing);
        const wRoof = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.95, 12.6), roofMat);
        wRoof.position.set(sideX, 7.95, 0);
        bGroup.add(wRoof);
      }

      const uniRoof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.hypot(b.width, b.depth) * 0.56, 4.5, 4),
        roofMat,
      );
      uniRoof.position.y = b.height + 2.25;
      uniRoof.rotation.y = Math.PI / 4;
      bGroup.add(uniRoof);
    } else if (b.roofShape === 'modern_stepped') {
      const mainBody = new THREE.Mesh(new THREE.BoxGeometry(b.width, b.height, b.depth), wallMat);
      mainBody.position.y = b.height / 2;
      mainBody.castShadow = true;
      bGroup.add(mainBody);

      const floors = Math.max(2, Math.floor(b.height / 3.0));
      for (let f = 1; f < floors; f++) {
        const winBand = new THREE.Mesh(
          new THREE.BoxGeometry(b.width + 0.2, 1.2, b.depth + 0.2),
          glassWindowMat,
        );
        winBand.position.y = f * 3.0;
        bGroup.add(winBand);
      }
      const crown = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.82, 1.7, b.depth * 0.82),
        roofMat,
      );
      crown.position.y = b.height + 0.85;
      bGroup.add(crown);
    } else {
      const mainBody = new THREE.Mesh(
        new THREE.BoxGeometry(b.width, b.height, b.depth),
        b.category === 'restaurant' || b.category === 'market' ? roofMat : wallMat,
      );
      mainBody.position.y = b.height / 2;
      mainBody.castShadow = true;
      bGroup.add(mainBody);

      const gable = new THREE.Mesh(
        new THREE.ConeGeometry(Math.hypot(b.width, b.depth) * 0.58, 3.0, 4),
        roofMat,
      );
      gable.position.y = b.height + 1.5;
      gable.rotation.y = Math.PI / 4;
      bGroup.add(gable);

      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.92, 0.3, 2.8),
        accentMat,
      );
      awning.position.set(0, 3.1, b.depth / 2 + 1.2);
      bGroup.add(awning);
    }

    const signTex = createSignboardTexture(
      renderer,
      b.nameMm,
      b.nameEn,
      b.color,
      b.accentColor,
    );
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(13.0, b.width * 0.95), 3.1, 0.38),
      signMat,
    );
    signBoard.position.set(0, b.height + 3.5, 0);
    bGroup.add(signBoard);

    if (b.interactPromptMm) {
      const porchRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.4, 0.12, 10, 28),
        new THREE.MeshBasicMaterial({ color: b.accentColor }),
      );
      porchRing.rotation.x = -Math.PI / 2;
      porchRing.position.set(0, 0.12, b.depth / 2 + 2.6);
      bGroup.add(porchRing);
    }

    root.add(bGroup);
  });

  return root;
}
