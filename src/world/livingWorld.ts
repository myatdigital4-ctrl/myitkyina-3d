import * as THREE from 'three';
import {
  MAP_PLACES,
  MYITKYINA_FAMOUS_BUILDINGS,
  MYITKYINA_INTERACTIVE_NPCS,
  MYITKYINA_ROAD_SEGMENTS,
  TimeOfDay,
  WeatherMode,
} from '../types/game';
import {
  createContactShadowTexture,
  createSignboardTexture,
  groundHeightAt,
  playableSurfaceHeightAt,
  riverCenterX,
  riverHalfWidth,
} from './terrain';
import { nearestStreetPoint, relocateLegacy, roadsidePoint } from './worldLayout';

// ============================================================================
// 1. ULTRA-HIGH-FIDELITY ATMOSPHERIC SKY DOME, VOLUMETRIC CLOUDS, STREETLAMPS
//    & MYITKYINA DYNAMIC WEATHER SYSTEM (CLEAR / WINTER MIST / TROPICAL RAIN)
// ============================================================================
export interface SkyAndWeatherController {
  group: THREE.Group;
  updateWeather: (
    elapsed: number,
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    timeOfDay: TimeOfDay,
    weather: WeatherMode,
  ) => void;
}

export function createSkyAndWeatherSystem(
  renderer: THREE.WebGLRenderer,
  roadMaterialsToWet: THREE.MeshStandardMaterial[],
): SkyAndWeatherController {
  const group = new THREE.Group();

  // A. Procedural Atmospheric Gradient Sky Dome (No flat background color)
  const skyGeo = new THREE.SphereGeometry(1180, 32, 20);
  const skyUniforms = {
    uTopColor: { value: new THREE.Color('#0284c7') },
    uHorizonColor: { value: new THREE.Color('#bae6fd') },
    uSunDir: { value: new THREE.Vector3(0.5, 0.6, 0.4).normalize() },
    uSunGlowColor: { value: new THREE.Color('#fef08a') },
  };

  const skyMat = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunGlowColor;

      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = clamp(dir.y * 1.45, 0.0, 1.0);
        vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.65));
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        col += uSunGlowColor * pow(sunAmt, 14.0) * 0.48;
        col += uSunGlowColor * smoothstep(0.996, 0.9995, sunAmt) * 1.2;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  group.add(skyDome);

  // B. Distant Kachin Highland Cloud Puff Ring
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: '#f8fafc',
    roughness: 0.92,
    metalness: 0.0,
    transparent: true,
    opacity: 0.82,
  });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const dist = 540 + (i % 3) * 85;
    const cluster = new THREE.Group();
    cluster.position.set(
      Math.cos(angle) * dist,
      92 + (i % 4) * 14,
      Math.sin(angle) * dist,
    );
    cluster.rotation.y = -angle + Math.PI / 2;

    for (let p = -1; p <= 1; p++) {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(18 - Math.abs(p) * 4, 1),
        cloudMat,
      );
      puff.position.set(p * 16, Math.abs(p) * -2, 0);
      puff.scale.set(1.6, 0.52, 0.9);
      cluster.add(puff);
    }
    cloudGroup.add(cluster);
  }
  group.add(cloudGroup);

  // C. Myitkyina Winter Morning Mist Layers (ဆောင်းမြူနှင်းလွှာ)
  const mistGroup = new THREE.Group();
  const mistTex = createContactShadowTexture();
  mistTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mistMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    color: '#e2e8f0',
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mistPatches: { mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number }[] = [];
  for (let m = 0; m < 16; m++) {
    const mx = -180 + (m % 4) * 125;
    const mz = -220 + Math.floor(m / 4) * 145;
    const mPlane = new THREE.Mesh(new THREE.PlaneGeometry(135, 135), mistMat);
    mPlane.rotation.x = -Math.PI / 2;
    const my = Math.max(0.5, groundHeightAt(mx, mz)) + 2.2 + (m % 3) * 1.4;
    mPlane.position.set(mx, my, mz);
    mistGroup.add(mPlane);
    mistPatches.push({ mesh: mPlane, baseX: mx, baseZ: mz, phase: m * 0.9 });
  }
  group.add(mistGroup);

  // D. 3D Tropical Rain Streak Particle System (မိုးရွာစနစ်)
  const rainCount = 700;
  const rainPositions = new Float32Array(rainCount * 6); // 2 vertices per rain streak line
  const rainOffsets: { x: number; y: number; z: number; speed: number }[] = [];
  for (let i = 0; i < rainCount; i++) {
    const rx = (Math.random() - 0.5) * 90;
    const ry = Math.random() * 38;
    const rz = (Math.random() - 0.5) * 90;
    const sp = 28 + Math.random() * 12;
    rainOffsets.push({ x: rx, y: ry, z: rz, speed: sp });

    const idx = i * 6;
    rainPositions[idx] = rx;
    rainPositions[idx + 1] = ry;
    rainPositions[idx + 2] = rz;
    rainPositions[idx + 3] = rx - 0.15;
    rainPositions[idx + 4] = ry - 1.45;
    rainPositions[idx + 5] = rz - 0.15;
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: '#bae6fd',
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  rainLines.visible = false;
  rainLines.frustumCulled = false;
  group.add(rainLines);

  // E. Warm Sitapu Streetlamps along Manau Main Road & Central Concrete Avenue Curbs
  const lampLocations = [
    [-95, 7.2],
    [-65, 7.2],
    [-40, 7.2],
    [-95, -7.2],
    [-65, -7.2],
    [-40, -7.2],
    [6.5, 45],
    [6.5, 85],
    [6.5, 130],
    [6.5, -45],
    [6.5, -82],
    [6.5, -135],
    [35, -88],
    [80, -88],
    [138, 12],
    [112, 85],
  ];

  const poleMat = new THREE.MeshStandardMaterial({
    color: '#1e293b',
    roughness: 0.3,
    metalness: 0.85,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: '#fef08a',
    emissive: '#f59e0b',
    emissiveIntensity: 0.6,
    roughness: 0.15,
  });
  const groundPoolMat = new THREE.MeshBasicMaterial({
    map: mistTex,
    color: '#fbbf24',
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  lampLocations.forEach(([lx, lz]) => {
    const lGroup = new THREE.Group();
    const ly = groundHeightAt(lx, lz);
    lGroup.position.set(lx, ly, lz);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.4, 8), poleMat);
    post.position.y = 2.7;
    post.castShadow = true;
    lGroup.add(post);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.12), poleMat);
    arm.position.set(-0.55, 5.35, 0);
    lGroup.add(arm);

    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.24, 8), bulbMat);
    lantern.position.set(-1.1, 5.2, 0);
    lGroup.add(lantern);

    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 9.5), groundPoolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(-1.1, 0.06, 0);
    lGroup.add(pool);

    group.add(lGroup);
  });

  const updateWeather = (
    elapsed: number,
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    timeOfDay: TimeOfDay,
    weather: WeatherMode,
  ) => {
    // Keep sky dome centered on player so horizon is infinite
    skyDome.position.set(playerX, 0, playerZ);
    cloudGroup.rotation.y = elapsed * 0.008;

    // Sky gradient colors based on TimeOfDay & Weather
    if (weather === 'rain') {
      skyUniforms.uTopColor.value.set('#1e293b');
      skyUniforms.uHorizonColor.value.set('#475569');
      skyUniforms.uSunGlowColor.value.set('#94a3b8');
    } else if (weather === 'mist') {
      skyUniforms.uTopColor.value.set('#64748b');
      skyUniforms.uHorizonColor.value.set('#e2e8f0');
      skyUniforms.uSunGlowColor.value.set('#fde047');
    } else if (timeOfDay === 'morning') {
      skyUniforms.uTopColor.value.set('#0284c7');
      skyUniforms.uHorizonColor.value.set('#bae6fd');
      skyUniforms.uSunGlowColor.value.set('#fef08a');
    } else if (timeOfDay === 'noon') {
      skyUniforms.uTopColor.value.set('#0369a1');
      skyUniforms.uHorizonColor.value.set('#7dd3fc');
      skyUniforms.uSunGlowColor.value.set('#ffffff');
    } else if (timeOfDay === 'sunset') {
      skyUniforms.uTopColor.value.set('#7c2d12');
      skyUniforms.uHorizonColor.value.set('#fb923c');
      skyUniforms.uSunGlowColor.value.set('#fde047');
    } else {
      skyUniforms.uTopColor.value.set('#020617');
      skyUniforms.uHorizonColor.value.set('#1e293b');
      skyUniforms.uSunGlowColor.value.set('#60a5fa');
    }

    // Streetlamp glow intensity
    const isDarkOrWet = timeOfDay === 'night' || timeOfDay === 'sunset' || weather !== 'clear';
    bulbMat.emissiveIntensity = isDarkOrWet ? 2.4 : 0.4;
    groundPoolMat.opacity = isDarkOrWet ? 0.38 : 0.0;

    // Wet road specular reflections when raining
    const targetRoughness = weather === 'rain' ? 0.16 : 0.78;
    const targetMetalness = weather === 'rain' ? 0.48 : 0.08;
    for (const rMat of roadMaterialsToWet) {
      rMat.roughness = THREE.MathUtils.damp(rMat.roughness, targetRoughness, 4, dt);
      rMat.metalness = THREE.MathUtils.damp(rMat.metalness, targetMetalness, 4, dt);
    }

    // Winter Mist animation
    const targetMistOpacity = weather === 'mist' ? 0.42 : weather === 'rain' ? 0.18 : 0.0;
    mistMat.opacity = THREE.MathUtils.damp(mistMat.opacity, targetMistOpacity, 3, dt);
    mistGroup.visible = mistMat.opacity > 0.01;
    if (mistGroup.visible) {
      for (const mp of mistPatches) {
        mp.mesh.position.x = mp.baseX + Math.sin(elapsed * 0.25 + mp.phase) * 14;
        mp.mesh.position.z = mp.baseZ + Math.cos(elapsed * 0.2 + mp.phase) * 14;
      }
    }

    // 3D Rain streaks animation around player
    rainLines.visible = weather === 'rain';
    if (rainLines.visible) {
      const posAttr = rainGeo.attributes.position as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < rainCount; i++) {
        const ro = rainOffsets[i];
        ro.y -= ro.speed * dt;
        if (ro.y < -2) {
          ro.y = 34 + Math.random() * 6;
          ro.x = (Math.random() - 0.5) * 85;
          ro.z = (Math.random() - 0.5) * 85;
        }
        const wx = playerX + ro.x;
        const wy = playerY + ro.y;
        const wz = playerZ + ro.z;
        const idx = i * 6;
        arr[idx] = wx;
        arr[idx + 1] = wy;
        arr[idx + 2] = wz;
        arr[idx + 3] = wx - 0.18;
        arr[idx + 4] = wy - 1.55;
        arr[idx + 5] = wz - 0.18;
      }
      posAttr.needsUpdate = true;
    }
  };

  return { group, updateWeather };
}

// ============================================================================
// 2. LIVING CITY AI TRAFFIC (လမ်းမပေါ်က AI ဘက်ထရီဆိုင်ကယ်များ၊ Toyota Crown ကားများနှင့် သုံးဘီးများ)
// ============================================================================
export interface AITrafficAgent {
  id: string;
  kind: 'ebike_a5' | 'ebike_white' | 'crown_sedan' | 'tuktuk';
  segIndex: number;
  t: number; // 0..1 along road segment
  dir: 1 | -1;
  baseSpeed: number;
  currentSpeed: number;
  x: number;
  z: number;
  heading: number;
  group: THREE.Group;
  wheels: THREE.Object3D[];
}

function createCrownSedanMesh(colorHex: string, shadowTex: THREE.Texture): {
  group: THREE.Group;
  wheels: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 5.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.04;
  group.add(shadowPlane);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.18,
    metalness: 0.65,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0f172a',
    roughness: 0.1,
    metalness: 0.85,
    clearcoat: 1.0,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.2,
    metalness: 0.9,
  });
  const tireMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.85 });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#fef08a',
    emissiveIntensity: 1.4,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: '#ef4444',
    emissive: '#dc2626',
    emissiveIntensity: 1.1,
  });

  // Lower Sedan Body
  const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.62, 4.65), paintMat);
  lowerBody.position.y = 0.68;
  lowerBody.castShadow = true;
  lowerBody.receiveShadow = true;
  group.add(lowerBody);

  // Sleek Greenhouse Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.58, 2.35), paintMat);
  cabin.position.set(0, 1.24, -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  // Tinted Windows Band
  const winBand = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.42, 2.2), glassMat);
  winBand.position.set(0, 1.22, -0.1);
  group.add(winBand);

  // Toyota Crown Chrome Front Grille & Headlights
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.32, 0.08), chromeMat);
  grille.position.set(0, 0.68, 2.34);
  group.add(grille);

  for (const hx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.08), headlightMat);
    hl.position.set(hx, 0.72, 2.34);
    group.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.18, 0.08), taillightMat);
    tl.position.set(hx, 0.74, -2.34);
    group.add(tl);
  }

  for (const [wx, wz] of [
    [-1.02, 1.42],
    [1.02, 1.42],
    [-1.02, -1.42],
    [1.02, -1.42],
  ]) {
    const wGroup = new THREE.Group();
    wGroup.position.set(wx, 0.42, wz);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wGroup.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 10), chromeMat);
    rim.rotation.z = Math.PI / 2;
    wGroup.add(rim);
    group.add(wGroup);
    wheels.push(wGroup);
  }

  return { group, wheels };
}

function createAIEBikeWithRiderMesh(
  isWhite: boolean,
  jacketColor: string,
  shadowTex: THREE.Texture,
): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 2.6),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.04;
  group.add(shadowPlane);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: isWhite ? '#f8fafc' : '#9ca3af',
    roughness: 0.2,
    metalness: isWhite ? 0.25 : 0.65,
    clearcoat: 1.0,
  });
  const blackMat = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.4 });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#eab308',
    emissiveIntensity: 0.8,
  });
  const ledMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#e0f2fe',
    emissiveIntensity: 1.4,
  });

  // Front & Rear Scooter Wheels
  for (const wz of [0.85, -0.78]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14), blackMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(0, 0.32, wz);
    group.add(w);
    wheels.push(w);
  }

  // Footboard & Rear Body
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 1.1), blackMat);
  deck.position.set(0, 0.36, 0);
  group.add(deck);

  const rearBody = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.42, 0.85), bodyMat);
  rearBody.position.set(0, 0.64, -0.42);
  rearBody.castShadow = true;
  group.add(rearBody);

  // Front Apron & Signature AIMA Grille/Headlamp
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.74, 0.26), bodyMat);
  apron.position.set(0, 0.92, 0.62);
  apron.rotation.x = -0.2;
  apron.castShadow = true;
  group.add(apron);

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.05), ledMat);
  lamp.position.set(0, 0.78, 0.76);
  group.add(lamp);

  if (!isWhite) {
    const yellowGrille = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.06), yellowMat);
    yellowGrille.position.set(0, 0.78, 0.77);
    group.add(yellowGrille);
  }

  // Handlebars & Visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.16), blackMat);
  visor.position.set(0, 1.38, 0.5);
  group.add(visor);

  // Seated Kachin Rider on the E-Bike
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.58, 0.28),
    new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.65 }),
  );
  torso.position.set(0, 1.32, -0.25);
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#f1c27d', roughness: 0.5 }),
  );
  head.position.set(0, 1.76, -0.22);
  group.add(head);

  return { group, wheels };
}

export function createLivingCityTraffic(renderer: THREE.WebGLRenderer): {
  group: THREE.Group;
  agents: AITrafficAgent[];
  updateTraffic: (dt: number, playerX: number, playerZ: number) => void;
} {
  const group = new THREE.Group();
  const shadowTex = createContactShadowTexture();
  shadowTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  // Street graph over real OSM segments: endpoints within ~1 m are the same junction
  const segs = MYITKYINA_ROAD_SEGMENTS;
  const isPaved = (i: number) => segs[i].surface === 'asphalt' || segs[i].surface === 'concrete';
  const nodeKey = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
  const nodeSegs = new Map<string, number[]>();
  segs.forEach((sg, i) => {
    if (!isPaved(i)) return;
    for (const k of [nodeKey(sg.x1, sg.z1), nodeKey(sg.x2, sg.z2)]) {
      const list = nodeSegs.get(k);
      if (list) list.push(i);
      else nodeSegs.set(k, [i]);
    }
  });
  let rngSeed = 4242;
  const rng = () => {
    rngSeed = (rngSeed * 16807) % 2147483647;
    return (rngSeed - 1) / 2147483646;
  };

  // Spawn on longer paved streets, spread around town, majors first
  const spawnPool = segs
    .map((sg, i) => ({ i, len: Math.hypot(sg.x2 - sg.x1, sg.z2 - sg.z1) }))
    .filter((e) => isPaved(e.i) && e.len > 35);
  const kinds: AITrafficAgent['kind'][] = ['ebike_a5', 'crown_sedan', 'ebike_white', 'ebike_a5', 'crown_sedan'];
  const colors = ['#dc2626', '#f8fafc', '#059669', '#2563eb', '#1e293b', '#d97706', '#e2e8f0', '#991b1b'];
  const trafficSpecs: {
    segIndex: number;
    t: number;
    dir: 1 | -1;
    kind: AITrafficAgent['kind'];
    speed: number;
    color: string;
  }[] = [];
  const usedSpawn: { x: number; z: number }[] = [];
  for (let tries = 0; trafficSpecs.length < 18 && tries < 500; tries++) {
    const e = spawnPool[Math.floor(rng() * Math.min(spawnPool.length, 60 + tries * 4))];
    if (!e) break;
    const sg = segs[e.i];
    const mx = (sg.x1 + sg.x2) / 2;
    const mz = (sg.z1 + sg.z2) / 2;
    if (usedSpawn.some((u) => Math.hypot(u.x - mx, u.z - mz) < 120)) continue;
    usedSpawn.push({ x: mx, z: mz });
    const kind = kinds[trafficSpecs.length % kinds.length];
    trafficSpecs.push({
      segIndex: e.i,
      t: 0.2 + rng() * 0.6,
      dir: rng() > 0.5 ? 1 : -1,
      kind,
      speed: kind === 'crown_sedan' ? 11 + rng() * 4 : 8 + rng() * 3,
      color: colors[trafficSpecs.length % colors.length],
    });
  }

  /** At a segment end, continue onto another paved street meeting at that junction. */
  const continueAtJunction = (ag: AITrafficAgent) => {
    const cur = segs[ag.segIndex];
    const atX = ag.dir === 1 ? cur.x2 : cur.x1;
    const atZ = ag.dir === 1 ? cur.z2 : cur.z1;
    const options = (nodeSegs.get(nodeKey(atX, atZ)) || []).filter((i) => i !== ag.segIndex);
    if (options.length === 0) {
      ag.dir = ag.dir === 1 ? -1 : 1; // dead end: U-turn
      return;
    }
    // Prefer going roughly straight
    const hx = (cur.x2 - cur.x1) * ag.dir;
    const hz = (cur.z2 - cur.z1) * ag.dir;
    let best = options[0];
    let bestScore = -Infinity;
    for (const i of options) {
      const sg = segs[i];
      const startsHere = nodeKey(sg.x1, sg.z1) === nodeKey(atX, atZ);
      const ox = startsHere ? sg.x2 - sg.x1 : sg.x1 - sg.x2;
      const oz = startsHere ? sg.z2 - sg.z1 : sg.z1 - sg.z2;
      const cos = (hx * ox + hz * oz) / (Math.hypot(hx, hz) * Math.hypot(ox, oz) || 1);
      const score = cos + rng() * 0.9;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    const nxt = segs[best];
    ag.segIndex = best;
    if (nodeKey(nxt.x1, nxt.z1) === nodeKey(atX, atZ)) {
      ag.dir = 1;
      ag.t = 0;
    } else {
      ag.dir = -1;
      ag.t = 1;
    }
  };

  const agents: AITrafficAgent[] = trafficSpecs.map((spec, idx) => {
    const built =
      spec.kind === 'crown_sedan'
        ? createCrownSedanMesh(spec.color, shadowTex)
        : createAIEBikeWithRiderMesh(spec.kind === 'ebike_white', spec.color, shadowTex);

    group.add(built.group);

    return {
      id: `ai_traffic_${idx}`,
      kind: spec.kind,
      segIndex: spec.segIndex % MYITKYINA_ROAD_SEGMENTS.length,
      t: spec.t,
      dir: spec.dir,
      baseSpeed: spec.speed,
      currentSpeed: spec.speed,
      x: 0,
      z: 0,
      heading: 0,
      group: built.group,
      wheels: built.wheels,
    };
  });

  const updateTraffic = (dt: number, playerX: number, playerZ: number) => {
    for (const ag of agents) {
      const seg = MYITKYINA_ROAD_SEGMENTS[ag.segIndex];
      const dx = seg.x2 - seg.x1;
      const dz = seg.z2 - seg.z1;
      const segLen = Math.max(0.5, Math.hypot(dx, dz));

      // Check distance to player so AI traffic yields politely instead of ramming the player
      const distToPlayer = Math.hypot(ag.x - playerX, ag.z - playerZ);
      const targetSpd = distToPlayer < 8.5 ? 0 : ag.baseSpeed;
      ag.currentSpeed = THREE.MathUtils.damp(ag.currentSpeed, targetSpd, 6, dt);

      ag.t += (ag.dir * ag.currentSpeed * dt) / segLen;
      if (ag.t > 1 || ag.t < 0) {
        continueAtJunction(ag);
        ag.t = THREE.MathUtils.clamp(ag.t, 0, 1);
        continue;
      }

      // Keep right-hand lane offset relative to travel direction
      const fwdX = (dx / segLen) * ag.dir;
      const fwdZ = (dz / segLen) * ag.dir;
      const rightX = -fwdZ;
      const rightZ = fwdX;
      const laneOffset = Math.min(2.6, seg.width * 0.24);

      ag.x = seg.x1 + dx * ag.t + rightX * laneOffset;
      ag.z = seg.z1 + dz * ag.t + rightZ * laneOffset;
      ag.heading = Math.atan2(fwdX, fwdZ);

      const y = playableSurfaceHeightAt(ag.x, ag.z);
      ag.group.position.set(ag.x, y, ag.z);
      ag.group.rotation.y = ag.heading;

      for (const w of ag.wheels) {
        w.rotation.x += ag.currentSpeed * dt * 1.8;
      }
    }
  };

  return { group, agents, updateTraffic };
}

// ============================================================================
// 3. LIVING CITY KACHIN NPCs: MANAU TRADITIONAL DANCERS & SITAPU PEDESTRIANS
// ============================================================================
export function createLivingCityNPCs(renderer: THREE.WebGLRenderer): {
  group: THREE.Group;
  updateNPCs: (elapsed: number, dt: number) => void;
} {
  const group = new THREE.Group();
  const shadowTex = createContactShadowTexture();
  shadowTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const skinMat = new THREE.MeshStandardMaterial({ color: '#f1c27d', roughness: 0.55 });
  const blackVelvetMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.7 });
  const kachinRedSkirtMat = new THREE.MeshStandardMaterial({ color: '#b91c1c', roughness: 0.65 });
  const silverSequinMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0',
    roughness: 0.2,
    metalness: 0.85,
  });
  const fanYellowMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#ca8a04',
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });

  // A. 10 Manau Festival Traditional Dancers (မနောကွင်းအတွင်း မနောအက ကနေသော ကချင်ရိုးရာ လူအုပ်စု)
  const dancers: {
    group: THREE.Group;
    leftArm: THREE.Group;
    rightArm: THREE.Group;
    angleOffset: number;
  }[] = [];

  for (let i = 0; i < 10; i++) {
    const dGroup = new THREE.Group();

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.04;
    dGroup.add(shadowPlane);

    // Woven Kachin Labu Skirt / Longyi
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 0.85, 12),
      kachinRedSkirtMat,
    );
    skirt.position.y = 0.45;
    skirt.castShadow = true;
    dGroup.add(skirt);

    // Black Velvet Palong Top with Silver Studs
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), blackVelvetMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    dGroup.add(torso);

    const silverCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.28, 0.14, 12),
      silverSequinMat,
    );
    silverCollar.position.y = 1.38;
    dGroup.add(silverCollar);

    // Head & Traditional Kachin Headdress
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), skinMat);
    head.position.y = 1.66;
    dGroup.add(head);

    const headdress = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.22, 0.18, 12),
      kachinRedSkirtMat,
    );
    headdress.position.y = 1.82;
    dGroup.add(headdress);

    // Left & Right Arms holding Yellow/Red Ceremonial Manau Fans (မနောယပ်တောင်)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.34, 1.38, 0);
    const lLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 8), blackVelvetMat);
    lLimb.position.y = -0.22;
    leftArm.add(lLimb);
    const lFan = new THREE.Mesh(new THREE.CircleGeometry(0.26, 10, 0, Math.PI), fanYellowMat);
    lFan.position.set(0, -0.48, 0.12);
    leftArm.add(lFan);
    dGroup.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.34, 1.38, 0);
    const rLimb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 4, 8), blackVelvetMat);
    rLimb.position.y = -0.22;
    rightArm.add(rLimb);
    const rFan = new THREE.Mesh(new THREE.CircleGeometry(0.26, 10, 0, Math.PI), fanYellowMat);
    rFan.position.set(0, -0.48, 0.12);
    rightArm.add(rFan);
    dGroup.add(rightArm);

    group.add(dGroup);
    dancers.push({
      group: dGroup,
      leftArm,
      rightArm,
      angleOffset: (i / 10) * Math.PI * 2,
    });
  }

  // B. 10 Sitapu Sidewalk Pedestrians (လမ်းလျှောက်နေသော ဒေသခံ NPC များ)
  const shirtColors = ['#0284c7', '#16a34a', '#d97706', '#9333ea', '#e11d48'];
  const pedestrians: {
    group: THREE.Group;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
    x1: number;
    z1: number;
    x2: number;
    z2: number;
    t: number;
    dir: 1 | -1;
    speed: number;
  }[] = [];

  // Pedestrians stroll the street edge in front of each game building and around the
  // station / market, so the sidewalks follow real streets.
  const pedAnchors = [
    ...MYITKYINA_FAMOUS_BUILDINGS.map((b) => ({ x: b.x, z: b.z })),
    MAP_PLACES.railwayStation,
    MAP_PLACES.downtown,
    { x: MAP_PLACES.downtown.x + 90, z: MAP_PLACES.downtown.z + 60 },
  ];
  const pedWalkPaths = pedAnchors.map((a) => {
    const p = roadsidePoint(a.x, a.z, 1.2);
    const hx = Math.sin(p.heading) * 18;
    const hz = Math.cos(p.heading) * 18;
    return [p.x - hx, p.z - hz, p.x + hx, p.z + hz];
  });

  pedWalkPaths.forEach(([x1, z1, x2, z2], idx) => {
    const pGroup = new THREE.Group();

    const leftLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.42, 4, 8),
      kachinRedSkirtMat,
    );
    leftLeg.position.set(-0.12, 0.42, 0);
    pGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.09, 0.42, 4, 8),
      kachinRedSkirtMat,
    );
    rightLeg.position.set(0.12, 0.42, 0);
    pGroup.add(rightLeg);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.62, 0.28),
      new THREE.MeshStandardMaterial({
        color: shirtColors[idx % shirtColors.length],
        roughness: 0.65,
      }),
    );
    body.position.y = 1.08;
    body.castShadow = true;
    pGroup.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), skinMat);
    head.position.y = 1.62;
    pGroup.add(head);

    group.add(pGroup);
    pedestrians.push({
      group: pGroup,
      leftLeg,
      rightLeg,
      x1,
      z1,
      x2,
      z2,
      t: (idx * 0.17) % 1,
      dir: idx % 2 === 0 ? 1 : -1,
      speed: 2.6 + (idx % 3) * 0.4,
    });
  });

  const updateNPCs = (elapsed: number, dt: number) => {
    // Animate Manau Festival Circle Dancers around (0, 10) inside Manau Plaza
    for (let i = 0; i < dancers.length; i++) {
      const d = dancers[i];
      const angle = elapsed * 0.38 + d.angleOffset;
      const radius = 12.5 + Math.sin(elapsed * 1.2 + i) * 0.8;
      const dx = Math.cos(angle) * radius;
      const dz = 7.0 + Math.sin(angle) * radius * 0.72;
      const dy = groundHeightAt(dx, dz) + 0.42 + Math.abs(Math.sin(elapsed * 4.2 + i)) * 0.12;

      d.group.position.set(dx, dy, dz);
      // Face tangent along the ceremonial dance circle
      d.group.rotation.y = -angle;

      // Graceful synchronized Kachin Manau fan-waving arm choreography
      const wave = Math.sin(elapsed * 4.2 + i * 0.5);
      d.leftArm.rotation.z = 0.85 + wave * 0.42;
      d.leftArm.rotation.x = -0.45 + Math.cos(elapsed * 4.2 + i) * 0.25;
      d.rightArm.rotation.z = -0.85 - wave * 0.42;
      d.rightArm.rotation.x = -0.45 - Math.cos(elapsed * 4.2 + i) * 0.25;
    }

    // Animate Sitapu Pedestrians
    for (let i = 0; i < pedestrians.length; i++) {
      const p = pedestrians[i];
      const len = Math.max(5, Math.hypot(p.x2 - p.x1, p.z2 - p.z1));
      p.t += (p.dir * p.speed * dt) / len;
      if (p.t > 1) {
        p.t = 1;
        p.dir = -1;
      } else if (p.t < 0) {
        p.t = 0;
        p.dir = 1;
      }
      const px = p.x1 + (p.x2 - p.x1) * p.t;
      const pz = p.z1 + (p.z2 - p.z1) * p.t;
      const py = playableSurfaceHeightAt(px, pz);
      p.group.position.set(px, py, pz);
      p.group.rotation.y = Math.atan2((p.x2 - p.x1) * p.dir, (p.z2 - p.z1) * p.dir);

      const swing = Math.sin(elapsed * 7.5 + i) * 0.45;
      p.leftLeg.rotation.x = swing;
      p.rightLeg.rotation.x = -swing;
    }

    // Animate Interactive NPCs (gentle greeting wave & pulsing floor ring)
    for (let i = 0; i < interactiveNpcRigList.length; i++) {
      const npcRig = interactiveNpcRigList[i];
      npcRig.rightArm.rotation.z = -0.55 - Math.sin(elapsed * 3.4 + i) * 0.35;
      npcRig.rightArm.rotation.x = -0.65;
      npcRig.ringMesh.scale.setScalar(1.0 + Math.sin(elapsed * 3.2 + i) * 0.08);
      npcRig.badgeMesh.position.y = 2.65 + Math.sin(elapsed * 2.6 + i) * 0.08;
    }
  };

  // C. 6 Interactive Named NPCs (Shopkeepers, Quest Givers, Regular Citizens)
  const interactiveNpcRigList: {
    id: string;
    group: THREE.Group;
    rightArm: THREE.Mesh;
    ringMesh: THREE.Mesh;
    badgeMesh: THREE.Mesh;
  }[] = [];

  MYITKYINA_INTERACTIVE_NPCS.forEach((npc) => {
    const nGroup = new THREE.Group();
    const ny = playableSurfaceHeightAt(npc.x, npc.z);
    nGroup.position.set(npc.x, ny, npc.z);

    // Glowing Role Floor Ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: npc.accentColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ringMesh = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.48, 28), ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.08;
    nGroup.add(ringMesh);

    // Legs / Traditional Longyi Skirt
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.36, 0.88, 12),
      new THREE.MeshStandardMaterial({ color: '#7f1d1d', roughness: 0.7 }),
    );
    skirt.position.y = 0.44;
    skirt.castShadow = true;
    nGroup.add(skirt);

    const jacketColor =
      npc.role === 'shopkeeper'
        ? '#065f46'
        : npc.role === 'quest_giver'
          ? '#1e3a8a'
          : '#7c2d12';

    // Torso Jacket
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.68, 0.32),
      new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.55 }),
    );
    torso.position.y = 1.18;
    torso.castShadow = true;
    nGroup.add(torso);

    // Head & Kachin Headband
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skinMat);
    head.position.y = 1.72;
    nGroup.add(head);

    const headband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.235, 0.235, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: npc.accentColor, roughness: 0.4 }),
    );
    headband.position.y = 1.82;
    nGroup.add(headband);

    // Arms
    const armMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.55 });
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), armMat);
    leftArm.position.set(-0.36, 1.2, 0);
    nGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), armMat);
    rightArm.position.set(0.36, 1.28, 0);
    nGroup.add(rightArm);

    // Floating 3D Name & Role Signboard above NPC
    const signTex = createSignboardTexture(
      renderer,
      npc.nameMm,
      `${npc.roleLabelMm} (${npc.locationMm})`,
      jacketColor,
      npc.accentColor,
    );
    const badgeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.78, 0.12),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    badgeMesh.position.y = 2.65;
    nGroup.add(badgeMesh);

    group.add(nGroup);
    interactiveNpcRigList.push({
      id: npc.id,
      group: nGroup,
      rightArm,
      ringMesh,
      badgeMesh,
    });
  });

  return { group, updateNPCs };
}

// ============================================================================
// 4. INTERACTIVE 3D MISSION BEACONS (KACHIN FOOD DELIVERY & SITAPU TIME TRIAL)
// ============================================================================
const deliveryAt = (id: string, fallback: { x: number; z: number }) => {
  const b = MYITKYINA_FAMOUS_BUILDINGS.find((f) => f.id === id) ?? fallback;
  return roadsidePoint(b.x, b.z, 1.5);
};

export const DELIVERY_STOPS = [
  {
    ...deliveryAt('bldg_lung_ga_pa', { x: -70, z: 70 }),
    labelMm: 'လုံဂါပါ ကချင်ရိုးရာဆိုင် ရှေ့မှ အော်ဒါထုပ် ယူပါ',
  },
  {
    ...deliveryAt('bldg_palm_spring', MAP_PLACES.downtown),
    labelMm: 'ပို့ဆောင်ရန် (၁/၃): Palm Spring Resort ရှေ့',
  },
  {
    ...deliveryAt('bldg_myitkyina_cafe', MAP_PLACES.downtown),
    labelMm: 'ပို့ဆောင်ရန် (၂/၃): Myitkyina Cafe ရှေ့',
  },
  {
    ...roadsidePoint(MAP_PLACES.railwayStation.x, MAP_PLACES.railwayStation.z, 1.5),
    labelMm: 'ပို့ဆောင်ရန် (၃/၃): မြစ်ကြီးနား မီးရထားဘူတာ ရှေ့',
  },
];

const gateOnMain = (x: number, z: number) => {
  const p = nearestStreetPoint(x, z, true);
  return { x: Math.round(p.x), z: Math.round(p.z) };
};

export const TIME_TRIAL_GATES = [
  { x: 0, z: 62, labelMm: 'ဂိတ် (၁/၆): မနောကွင်း တောင်ဘက်အဝင်ဂိတ်' },
  { ...gateOnMain(MAP_PLACES.railwayStation.x, MAP_PLACES.railwayStation.z), labelMm: 'ဂိတ် (၂/၆): မီးရထားဘူတာ ရှေ့လမ်း' },
  { ...gateOnMain(MAP_PLACES.ramjankiTemple.x, MAP_PLACES.ramjankiTemple.z), labelMm: 'ဂိတ် (၃/၆): ဟိန္ဒူဘုရားကျောင်း လမ်း' },
  { ...gateOnMain(MAP_PLACES.downtown.x + 250, MAP_PLACES.downtown.z - 150), labelMm: 'ဂိတ် (၄/၆): မြို့လယ် အရှေ့ဘက်လမ်း' },
  { ...gateOnMain(MAP_PLACES.downtown.x, MAP_PLACES.downtown.z), labelMm: 'ဂိတ် (၅/၆): မြို့မဈေး လမ်းမ' },
  { x: 0, z: -62, labelMm: 'ပန်းဝင်ဂိတ် (၆/၆): မနောကွင်း မြောက်ဘက်အဝင်ဂိတ်' },
];

export function createChallengeMarkers(): {
  group: THREE.Group;
  deliveryMarker: THREE.Group;
  raceGateMarker: THREE.Group;
  updateMarkers: (
    elapsed: number,
    activeType: 'delivery' | 'timetrial' | null,
    targetX: number,
    targetZ: number,
  ) => void;
} {
  const group = new THREE.Group();

  // 1. Glowing Golden/Emerald Beacon for Kachin Food Delivery
  const deliveryMarker = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#f59e0b',
    emissiveIntensity: 1.6,
  });
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.22, 12, 36), ringMat);
  baseRing.rotation.x = Math.PI / 2;
  baseRing.position.y = 0.2;
  deliveryMarker.add(baseRing);

  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 22, 24, 1, true), beamMat);
  beam.position.y = 11;
  deliveryMarker.add(beam);

  // Floating 3D Kachin Food Delivery Parcel Box
  const parcel = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.1, 1.4),
    new THREE.MeshStandardMaterial({
      color: '#dc2626',
      emissive: '#991b1b',
      emissiveIntensity: 0.5,
      roughness: 0.3,
    }),
  );
  parcel.position.y = 2.4;
  deliveryMarker.add(parcel);
  deliveryMarker.visible = false;
  group.add(deliveryMarker);

  // 2. Towering Glowing Checkpoint Arch for Sitapu Street Time Trial
  const raceGateMarker = new THREE.Group();
  const archMat = new THREE.MeshStandardMaterial({
    color: '#10b981',
    emissive: '#059669',
    emissiveIntensity: 1.8,
  });
  const archTorus = new THREE.Mesh(
    new THREE.TorusGeometry(5.6, 0.36, 12, 32, Math.PI),
    archMat,
  );
  archTorus.position.y = 0.2;
  raceGateMarker.add(archTorus);

  const gateFloorRing = new THREE.Mesh(new THREE.TorusGeometry(5.4, 0.24, 10, 32), archMat);
  gateFloorRing.rotation.x = Math.PI / 2;
  gateFloorRing.position.y = 0.18;
  raceGateMarker.add(gateFloorRing);
  raceGateMarker.visible = false;
  group.add(raceGateMarker);

  const updateMarkers = (
    elapsed: number,
    activeType: 'delivery' | 'timetrial' | null,
    targetX: number,
    targetZ: number,
  ) => {
    if (activeType === 'delivery') {
      deliveryMarker.visible = true;
      raceGateMarker.visible = false;
      const y = playableSurfaceHeightAt(targetX, targetZ);
      deliveryMarker.position.set(targetX, y, targetZ);
      parcel.rotation.y = elapsed * 2.2;
      parcel.position.y = 2.2 + Math.sin(elapsed * 3.5) * 0.35;
    } else if (activeType === 'timetrial') {
      deliveryMarker.visible = false;
      raceGateMarker.visible = true;
      const y = playableSurfaceHeightAt(targetX, targetZ);
      raceGateMarker.position.set(targetX, y, targetZ);
      archTorus.rotation.y = elapsed * 1.4;
    } else {
      deliveryMarker.visible = false;
      raceGateMarker.visible = false;
    }
  };

  return { group, deliveryMarker, raceGateMarker, updateMarkers };
}

// ============================================================================
// 5. ARCADE GAMEPLAY BOOSTERS: NITRO SPEED RINGS, GOLDEN KACHIN TREASURE CHESTS
//    & 3D DRAGON SHOCKWAVE SLASH VFX
// ============================================================================
export interface SpeedRingItem {
  id: string;
  x: number;
  z: number;
  cooldown: number;
  group: THREE.Group;
  innerRing: THREE.Mesh;
}

export interface TreasureChestItem {
  id: string;
  x: number;
  z: number;
  opened: boolean;
  respawnTimer: number;
  group: THREE.Group;
  crownMesh: THREE.Mesh;
}

export function createArcadeBoostRingsAndChests(): {
  group: THREE.Group;
  speedRings: SpeedRingItem[];
  treasureChests: TreasureChestItem[];
  shockwaveMesh: THREE.Mesh;
  triggerShockwave: (x: number, y: number, z: number, colorHex?: string) => void;
  updateArcadeItems: (elapsed: number, dt: number) => void;
} {
  const group = new THREE.Group();

  // A. 12 Glowing Cyan-Gold Nitro Speed Boost Rings along Sitapu Roads, Bridge & Jaw Bum Trail
  // Spread over real main streets; each ring faces along its street
  const ringLocations: [number, number, number][] = [
    [0, 68],
    [0, 145],
    [0, -65],
    [0, -155],
    [-75, 0],
    [45, -95],
    [-55, 65],
    [85, 0],
    [138, 95],
    [185, -362],
    [-125, 165],
    [436, -295],
  ].map(([x, z]) => {
    const p = relocateLegacy(x, z, true);
    return [p.x, p.z, p.heading] as [number, number, number];
  });

  const outerRingMat = new THREE.MeshStandardMaterial({
    color: '#06b6d4',
    emissive: '#0891b2',
    emissiveIntensity: 1.8,
    roughness: 0.2,
  });
  const innerRingMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#eab308',
    emissiveIntensity: 2.0,
    roughness: 0.15,
  });

  const speedRings: SpeedRingItem[] = ringLocations.map(([rx, rz, rotY], idx) => {
    const rGroup = new THREE.Group();
    const ry = playableSurfaceHeightAt(rx, rz);
    rGroup.position.set(rx, ry, rz);
    rGroup.rotation.y = rotY;

    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.22, 10, 28, Math.PI),
      outerRingMat,
    );
    outer.position.y = 0.2;
    rGroup.add(outer);

    const inner = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.14, 8, 24), innerRingMat);
    inner.position.y = 1.8;
    rGroup.add(inner);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 1.8), innerRingMat);
    pad.position.y = 0.05;
    rGroup.add(pad);

    group.add(rGroup);
    return {
      id: `speed_ring_${idx}`,
      x: rx,
      z: rz,
      cooldown: 0,
      group: rGroup,
      innerRing: inner,
    };
  });

  // B. 10 Golden Kachin Royal Treasure Chests (ရတနာသေတ္တာများ)
  const chestLocations: [number, number][] = [
    [0, 26], // Manau plaza
    ...[
      [-55, 52],
      [48, -106],
      [52, 218],
      [-25, -268],
      [-108, 322],
      [35, 128],
    ].map(([x, z]) => {
      const p = relocateLegacy(x, z, false);
      return [p.x, p.z] as [number, number];
    }),
    [MAP_PLACES.pagodaJetty.x - 30, MAP_PLACES.pagodaJetty.z + 18], // Pagoda courtyard
    [MAP_PLACES.strandNorth.x - 12, MAP_PLACES.strandNorth.z + 40], // Strand Road riverside
    [MAP_PLACES.kbcHeadquarters.x, MAP_PLACES.kbcHeadquarters.z + 25], // Kachin Baptist quarter
  ];

  const chestBoxMat = new THREE.MeshStandardMaterial({
    color: '#991b1b',
    roughness: 0.35,
    metalness: 0.4,
  });
  const chestGoldMat = new THREE.MeshStandardMaterial({
    color: '#fbbf24',
    emissive: '#d97706',
    emissiveIntensity: 0.9,
    roughness: 0.2,
    metalness: 0.85,
  });

  const treasureChests: TreasureChestItem[] = chestLocations.map(([cx, cz], idx) => {
    const cGroup = new THREE.Group();
    const cy = playableSurfaceHeightAt(cx, cz);
    cGroup.position.set(cx, cy, cz);

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 1.05), chestBoxMat);
    base.position.y = 0.48;
    base.castShadow = true;
    cGroup.add(base);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.32, 1.12), chestGoldMat);
    lid.position.y = 1.02;
    lid.castShadow = true;
    cGroup.add(lid);

    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 8, 24), chestGoldMat);
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.1;
    cGroup.add(glowRing);

    const crownMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), chestGoldMat);
    crownMesh.position.y = 2.1;
    cGroup.add(crownMesh);

    group.add(cGroup);
    return {
      id: `chest_${idx}`,
      x: cx,
      z: cz,
      opened: false,
      respawnTimer: 0,
      group: cGroup,
      crownMesh,
    };
  });

  // C. 3D Expanding Dragon Shockwave Ring for Sword Slashes & Vehicle Turbo
  const shockwaveMat = new THREE.MeshBasicMaterial({
    color: '#34d399',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shockwaveMesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.45, 32), shockwaveMat);
  shockwaveMesh.rotation.x = -Math.PI / 2;
  shockwaveMesh.visible = false;
  group.add(shockwaveMesh);

  let shockwaveTimer = 0;

  const triggerShockwave = (x: number, y: number, z: number, colorHex = '#34d399') => {
    shockwaveTimer = 0.38;
    shockwaveMesh.visible = true;
    shockwaveMesh.position.set(x, y + 0.35, z);
    shockwaveMesh.scale.set(1, 1, 1);
    shockwaveMat.color.set(colorHex);
    shockwaveMat.opacity = 0.9;
  };

  const updateArcadeItems = (elapsed: number, dt: number) => {
    for (const sr of speedRings) {
      if (sr.cooldown > 0) {
        sr.cooldown = Math.max(0, sr.cooldown - dt);
        sr.group.visible = sr.cooldown <= 0;
      } else {
        sr.innerRing.rotation.z = elapsed * 3.2;
      }
    }

    for (const ch of treasureChests) {
      if (ch.opened) {
        ch.respawnTimer -= dt;
        if (ch.respawnTimer <= 0) {
          ch.opened = false;
          ch.group.visible = true;
        }
      } else {
        ch.crownMesh.rotation.y = elapsed * 2.5;
        ch.crownMesh.position.y = 2.05 + Math.sin(elapsed * 3.8) * 0.22;
      }
    }

    if (shockwaveTimer > 0) {
      shockwaveTimer = Math.max(0, shockwaveTimer - dt);
      const progress = 1 - shockwaveTimer / 0.38;
      const sc = 1 + progress * 6.5;
      shockwaveMesh.scale.set(sc, sc, 1);
      shockwaveMat.opacity = (1 - progress) * 0.85;
      if (shockwaveTimer <= 0) {
        shockwaveMesh.visible = false;
      }
    }
  };

  return {
    group,
    speedRings,
    treasureChests,
    shockwaveMesh,
    triggerShockwave,
    updateArcadeItems,
  };
}

// 9. AYEYARWADY RIVERBANK & UNDER BALAMINHTIN BRIDGE 3D FISHING SPOTS (ဗလမင်းထင်တံတားအောက် နှင့် ဧရာဝတီမြစ်ဘေး ငါးမျှားစခန်းများ)
export interface FishingSpotNode {
  id: string;
  nameMm: string;
  nameEn: string;
  x: number;
  z: number;
  waterX: number;
  waterZ: number;
  bonusMultiplier: number;
}

/** Stand on the west bank (6 m inland) and cast to water 14 m out. */
function riverFishingSpot(z: number) {
  const edge = riverCenterX(z) - riverHalfWidth(z);
  return { x: Math.round(edge - 6), z, waterX: Math.round(edge + 14), waterZ: z };
}

export const FISHING_SPOTS: FishingSpotNode[] = [
  {
    // id kept for save compatibility
    id: 'spot_balaminhtin',
    nameMm: 'ကမ်းနားလမ်း မြောက်ပိုင်း ငါးမျှားဆိပ် (Strand Road North)',
    nameEn: 'Strand Road North Fishing Spot',
    ...riverFishingSpot(MAP_PLACES.strandNorth.z),
    bonusMultiplier: 1.5,
  },
  {
    id: 'spot_sitapu_jetty',
    nameMm: 'ဆုတောင်းပြည့်စေတီ ကမ်းနား ငါးမျှားဆိပ် (Pagoda Jetty)',
    nameEn: 'Sutaungpyae Pagoda Jetty',
    ...riverFishingSpot(MAP_PLACES.pagodaJetty.z + 30),
    bonusMultiplier: 1.2,
  },
  {
    id: 'spot_myitsone',
    nameMm: 'ကမ်းနားလမ်း တောင်ပိုင်း ငါးမျှားဆိပ် (Strand Road South)',
    nameEn: 'Strand Road South Fishing Spot',
    ...riverFishingSpot(MAP_PLACES.strandSouth.z),
    bonusMultiplier: 1.8,
  },
];

export function createAyeyarwadyFishingSpots() {
  const group = new THREE.Group();

  const woodDeckMat = new THREE.MeshStandardMaterial({
    color: '#78350f',
    roughness: 0.85,
  });
  const bambooMat = new THREE.MeshStandardMaterial({
    color: '#d97706',
    roughness: 0.65,
  });
  const glowRingMat = new THREE.MeshBasicMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const fishShadowMat = new THREE.MeshBasicMaterial({
    color: '#0284c7',
    transparent: true,
    opacity: 0.65,
  });

  const animatedRings: THREE.Mesh[] = [];
  const swimmingFishGroups: { group: THREE.Group; baseAngle: number; speed: number; radius: number }[] = [];

  FISHING_SPOTS.forEach((spot, idx) => {
    const spotGroup = new THREE.Group();
    const gy = groundHeightAt(spot.x, spot.z);
    spotGroup.position.set(spot.x, gy, spot.z);

    // Wooden Fishing Pier extending toward the Ayeyarwady water
    const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.28, 4.4), woodDeckMat);
    pierDeck.position.set(3.2, 0.35, 0);
    pierDeck.castShadow = true;
    pierDeck.receiveShadow = true;
    spotGroup.add(pierDeck);

    // 6 Bamboo Pier Support Posts
    for (const px of [0, 3.2, 6.4]) {
      for (const pz of [-1.8, 1.8]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8), bambooMat);
        post.position.set(px, 0.1, pz);
        post.castShadow = true;
        spotGroup.add(post);
      }
    }

    // Traditional Kachin Bamboo Fishing Hut Canopy & Lantern by the Pier
    const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 8), bambooMat);
    lanternPost.position.set(0.4, 1.7, -1.8);
    spotGroup.add(lanternPost);

    const lanternOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#fde047' }),
    );
    lanternOrb.position.set(0.4, 3.4, -1.8);
    spotGroup.add(lanternOrb);

    // Bamboo Fish Basket (ငါးပလိုင်း) on the Pier
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.75, 10), bambooMat);
    basket.position.set(2.4, 0.85, 1.3);
    spotGroup.add(basket);

    // Glowing Aqua Interaction Ring on the Pier
    const pierRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.1, 28), glowRingMat);
    pierRing.rotation.x = -Math.PI / 2;
    pierRing.position.set(2.2, 0.52, 0);
    spotGroup.add(pierRing);
    animatedRings.push(pierRing);

    group.add(spotGroup);

    // Water Ripple Ring & Swimming Fish Silhouettes in the River
    const waterCenter = new THREE.Group();
    waterCenter.position.set(spot.waterX, -0.22, spot.waterZ);

    const rippleRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.65, 32), glowRingMat);
    rippleRing.rotation.x = -Math.PI / 2;
    waterCenter.add(rippleRing);
    animatedRings.push(rippleRing);

    for (let f = 0; f < 4; f++) {
      const fishG = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.15, 8), fishShadowMat);
      body.rotation.x = Math.PI / 2;
      fishG.add(body);
      waterCenter.add(fishG);
      swimmingFishGroups.push({
        group: fishG,
        baseAngle: (f / 4) * Math.PI * 2 + idx,
        speed: 1.2 + (f % 2) * 0.45,
        radius: 1.35 + (f % 3) * 0.45,
      });
    }

    group.add(waterCenter);
  });

  // 3D Floating Red & White Fishing Bobber (ငါးမျှားဖော့တုံး) shown in water when player casts line
  const bobberGroup = new THREE.Group();
  const bobberTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#ef4444' }),
  );
  bobberTop.position.y = 0.16;
  bobberGroup.add(bobberTop);

  const bobberBottom = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#f8fafc' }),
  );
  bobberBottom.position.y = -0.08;
  bobberGroup.add(bobberBottom);

  const bobberRipple = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.78, 24),
    new THREE.MeshBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    }),
  );
  bobberRipple.rotation.x = -Math.PI / 2;
  bobberRipple.position.y = 0.05;
  bobberGroup.add(bobberRipple);
  bobberGroup.visible = false;
  group.add(bobberGroup);

  const updateFishingWorld = (
    elapsed: number,
    bobberState: { visible: boolean; x: number; z: number; biting: boolean },
  ) => {
    for (let i = 0; i < animatedRings.length; i++) {
      const r = animatedRings[i];
      const sc = 1 + Math.sin(elapsed * 3.2 + i) * 0.1;
      r.scale.set(sc, sc, 1);
    }

    for (const sf of swimmingFishGroups) {
      const ang = sf.baseAngle + elapsed * sf.speed;
      sf.group.position.set(Math.cos(ang) * sf.radius, 0, Math.sin(ang) * sf.radius);
      sf.group.rotation.y = -ang + Math.PI;
    }

    bobberGroup.visible = bobberState.visible;
    if (bobberState.visible) {
      const bobY = bobberState.biting
        ? -0.35 + Math.sin(elapsed * 26) * 0.26
        : -0.22 + Math.sin(elapsed * 4.5) * 0.08;
      bobberGroup.position.set(bobberState.x, bobY, bobberState.z);
      const ripScale = bobberState.biting
        ? 1.4 + Math.sin(elapsed * 20) * 0.55
        : 1.0 + Math.sin(elapsed * 4) * 0.18;
      bobberRipple.scale.set(ripScale, ripScale, 1);
    }
  };

  return {
    group,
    spots: FISHING_SPOTS,
    bobberGroup,
    updateFishingWorld,
  };
}


