import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MusicTrackId, soundEngine } from '../audio/soundEngine';
import { getSettings, onSettingsChanged, QUALITY_PROFILES } from '../settings/gameSettings';
import { WORLD_BOUNDS } from '../world/mapData.generated';
import {
  AUTOSAVE_INTERVAL_MS,
  GameSaveData,
  SAVE_VERSION,
  clearSave,
  loadGame,
  mergeQuestProgress,
  saveGame,
} from '../save/saveSystem';
import {
  ActiveChallengeState,
  CameraMode,
  DEFAULT_OSM_CITY_SPAWNS,
  FISHING_GEAR_TIERS,
  FishCatchInfo,
  FishingPhase,
  FishingRodLevel,
  GamePhase,
  HUDState,
  CITY_TOUR_STOP_IDS,
  STATION_QUEST,
  INITIAL_QUESTS,
  InteractiveNpcInfo,
  ManauBeatKey,
  ManauHitRating,
  MYITKYINA_FAMOUS_BUILDINGS,
  MYITKYINA_INTERACTIVE_NPCS,
  MYITKYINA_LANDMARKS,
  MinimapEntity,
  Osm3DStats,
  OsmBuildingFootprint,
  OsmCitySpawnPoint,
  OsmNamedPlace,
  OsmRoadPolyline,
  TimeOfDay,
  WeatherMode,
} from '../types/game';
import {
  createArcadeBoostRingsAndChests,
  createAyeyarwadyFishingSpots,
  createChallengeMarkers,
  createLivingCityNPCs,
  createLivingCityTraffic,
  createSkyAndWeatherSystem,
  DELIVERY_STOPS,
  FISHING_SPOTS,
  SCENIC_ROUTES,
  type ScenicRouteId,
  FishingSpotNode,
  TIME_TRIAL_GATES,
} from '../world/livingWorld';
import {
  createAyeyarwadyWaterMesh,
  createStrandRoadCheckpoints,
  createFamousMyitkyinaBuildings,
  createInstancedFoliageAndRocks,
  createKachinHero,
  createManauParkComplex,
  createMini3DRoadsAndTrafficLights,
  createMyitkyinaTerrainMesh,
  createPlayableVehicle,
  createSmugglerEnemies,
  createSutaungpyaePagoda,
  WorldVehicle,
} from '../world/models';
import {
  groundHeightAt,
  isBridgeDeck,
  playableSurfaceHeightAt,
  riverCenterX,
  waterSignedDistance,
} from '../world/terrain';
import {
  buildMyitkyinaOsm3DGroup,
  parseOsmXmlToGeoJson,
} from '../world/osm3dBuilder';

// Pre-allocated math helpers at module scope (Zero GC in the render loop)
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _smoothLookAt = new THREE.Vector3(0, 3, 25);
const _hitColor = new THREE.Color('#ffffff');
const _baseEnemyColor = new THREE.Color('#7f1d1d');

// Traditional 8-beat Kachin Manau Ceremonial Dance Sequence
const MANAU_DANCE_PATTERN: ManauBeatKey[] = [
  'left',
  'right',
  'up',
  'down',
  'left',
  'up',
  'right',
  'down',
];

const MANAU_BEAT_LABELS_MM: Record<ManauBeatKey, string> = {
  left: '◀ ဘယ်ယပ်ဝှေ့ (Left Fan)',
  up: '▲ ငှက်မောင်နှံမြှောက် (Hornbill Lift)',
  down: '▼ စည်တော်နင်းချက် (Drum Step)',
  right: '▶ ညာယပ်ဝှေ့ (Right Fan)',
};

// Authentic Ayeyarwady River & Under Balaminhtin Bridge Fish Species Catalog (Priced in Myanmar Kyat - MMK)
const AYEYARWADY_FISH_CATALOG: {
  id: string;
  nameMm: string;
  nameEn: string;
  rarity: 'common' | 'rare' | 'legendary';
  minKg: number;
  maxKg: number;
  basePriceMmk: number;
  icon: string;
  speed: number;
}[] = [
  {
    id: 'fish_carp',
    nameMm: 'ဧရာဝတီ ငါးကြင်းဖြူ',
    nameEn: 'Ayeyarwady Silver Carp',
    rarity: 'common',
    minKg: 1.4,
    maxKg: 4.5,
    basePriceMmk: 8500,
    icon: '🐟',
    speed: 35,
  },
  {
    id: 'fish_featherback',
    nameMm: 'မလိခ ငါးဘတ်ကြီး',
    nameEn: 'Mali Hka Featherback',
    rarity: 'common',
    minKg: 1.8,
    maxKg: 5.8,
    basePriceMmk: 11500,
    icon: '🐡',
    speed: 40,
  },
  {
    id: 'fish_catfish',
    nameMm: 'ဗလမင်းထင် တံတားအောက် ငါးတန်ကြီး',
    nameEn: 'Balaminhtin Giant River Catfish',
    rarity: 'rare',
    minKg: 5.2,
    maxKg: 14.6,
    basePriceMmk: 22000,
    icon: '🦈',
    speed: 52,
  },
  {
    id: 'fish_mahseer',
    nameMm: 'ကချင် ရွှေငါးမြင်း (Golden Mahseer)',
    nameEn: 'Golden Kachin Highland Mahseer',
    rarity: 'rare',
    minKg: 3.4,
    maxKg: 9.2,
    basePriceMmk: 26000,
    icon: '🐠',
    speed: 56,
  },
  {
    id: 'fish_dolphin_blessing',
    nameMm: 'ဧရာဝတီ ရွှေငါးတန်ဘုရင်ကြီး (Royal Giant Catfish)',
    nameEn: 'Royal Ayeyarwady Giant Catfish',
    rarity: 'legendary',
    minKg: 18.0,
    maxKg: 38.0,
    basePriceMmk: 44000,
    icon: '🐋',
    speed: 62,
  },
  {
    id: 'fish_jade_urn',
    nameMm: 'မလိခ-မေခ မြစ်ဆုံ ဧရာမ ငါးရံ့ဒိုင်းကြီး',
    nameEn: 'Myitsone trophy Giant Snakehead',
    rarity: 'legendary',
    minKg: 9.5,
    maxKg: 21.5,
    basePriceMmk: 52000,
    icon: '🐊',
    speed: 60,
  },
];

// Shortest angle difference helper (-PI to +PI)
function shortestAngleDiff(from: number, to: number): number {
  let diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export interface GameControllerActions {
  startGame: () => void;
  /** သိမ်းထားသော save ဖိုင်မှ ဆက်ကစားမည် */
  continueGame: () => void;
  /** လက်ရှိအခြေအနေကို ချက်ချင်းသိမ်းမည် */
  saveNow: () => void;
  resumeGame: () => void;
  pauseGame: () => void;
  restartGame: () => void;
  teleportToRegion: (x: number, z: number, nameMm: string) => void;
  summonVehicle: (type: 'ebike' | 'hilux4x4' | 'tuktuk' | 'riverboat') => void;
  setTimeOfDay: (tod: TimeOfDay) => void;
  /** Relaxed, untimed routes: sunset e-bike ride or early-morning jog */
  startScenicRoute: (id: ScenicRouteId) => void;
  stopScenicRoute: () => void;
  setWeather: (weather: WeatherMode) => void;
  startFoodDelivery: () => void;
  startStreetTimeTrial: () => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleMute: () => void;
  triggerActionAttack: () => void;
  toggleEnterExitVehicle: () => void;
  setVirtualStick: (x: number, y: number, sprinting: boolean) => void;
  setVirtualJumpBrake: (held: boolean) => void;
  setVirtualThrottle: (throttle: number) => void;
  resetCameraBehindPlayer: () => void;
  setWaypoint: (x: number, z: number, labelMm: string) => void;
  clearWaypoint: () => void;
  warpToActiveQuest: () => void;
  upgradeHeroLevel: () => void;
  toggleManauDance: () => void;
  pressManauRhythmKey: (key: ManauBeatKey) => void;
  startFishingAtSpot: (spotId?: string) => void;
  stopFishing: () => void;
  fishingActionTap: () => void;
  setFishingReelHeld: (held: boolean) => void;
  buyOrUpgradeFishingGear: () => void;
  sellCaughtFish: () => void;
  selectMusicTrack: (track: MusicTrackId) => void;
  cycleMusicTrack: () => void;
  uploadCustomSong: (file: File) => void;
  toggleOsm3DLayer: () => void;
  toggleOsmDebugMode: () => void;
  teleportToOsmCity: (spawnIndex?: number) => void;
  toggleOverheadCamera: () => void;
  uploadCustomOsmFile: (file: File) => Promise<void>;
  interactWithNpc: (npcId?: string) => void;
  closeNpcDialogue: () => void;
  selectNpcDialogueOption: (optionId: string) => void;
  buyOrSellNpcItem: (itemId: string) => void;
}

interface Props {
  onHudUpdate: (state: HUDState) => void;
  controllerRef: React.MutableRefObject<GameControllerActions | null>;
}

const TIME_PALETTES: Record<
  TimeOfDay,
  {
    skyHex: number;
    fogHex: number;
    sunHex: number;
    sunIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    sunPos: [number, number, number];
  }
> = {
  morning: {
    skyHex: 0x7dd3fc,
    fogHex: 0xbae6fd,
    sunHex: 0xfef08a,
    sunIntensity: 2.3,
    hemiSky: 0x93c5fd,
    hemiGround: 0x365314,
    hemiIntensity: 0.85,
    sunPos: [95, 110, 60],
  },
  noon: {
    skyHex: 0x38bdf8,
    fogHex: 0x93c5fd,
    sunHex: 0xffffff,
    sunIntensity: 2.6,
    hemiSky: 0x7dd3fc,
    hemiGround: 0x166534,
    hemiIntensity: 0.95,
    sunPos: [40, 160, 30],
  },
  sunset: {
    skyHex: 0xc2410c,
    fogHex: 0xfb923c,
    sunHex: 0xfde047,
    sunIntensity: 2.1,
    hemiSky: 0xf97316,
    hemiGround: 0x3f2e21,
    hemiIntensity: 0.75,
    sunPos: [-120, 65, 80],
  },
  night: {
    skyHex: 0x091326,
    fogHex: 0x0f172a,
    sunHex: 0x60a5fa,
    sunIntensity: 0.85,
    hemiSky: 0x1e3a8a,
    hemiGround: 0x090d16,
    hemiIntensity: 0.45,
    sunPos: [-60, 120, -60],
  },
};

export const MyitkyinaCanvas: React.FC<Props> = ({ onHudUpdate, controllerRef }) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const fpsLabelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // Player settings (Settings menu) — quality profile can change live
    let playerSettings = getSettings();
    let quality = QUALITY_PROFILES[playerSettings.graphicsQuality];
    soundEngine.setVolumes(playerSettings.musicVolume, playerSettings.sfxVolume);

    // 2. Renderer & Studio Color Pipeline
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl && quality.antialias,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, quality.maxPixelRatio));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl && quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 3. Scene, Environment Reflection (RoomEnvironment) & Lighting Rig
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(TIME_PALETTES.morning.skyHex);
    scene.fog = new THREE.FogExp2(TIME_PALETTES.morning.fogHex, 0.00045);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(
      TIME_PALETTES.morning.hemiSky,
      TIME_PALETTES.morning.hemiGround,
      TIME_PALETTES.morning.hemiIntensity,
    );
    hemiLight.position.set(0, 120, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      TIME_PALETTES.morning.sunHex,
      TIME_PALETTES.morning.sunIntensity,
    );
    sunLight.position.set(...TIME_PALETTES.morning.sunPos);
    sunLight.castShadow = !isSoftwareGl && quality.shadows;
    const shadowBound = 105;
    sunLight.shadow.camera.left = -shadowBound;
    sunLight.shadow.camera.right = shadowBound;
    sunLight.shadow.camera.top = shadowBound;
    sunLight.shadow.camera.bottom = -shadowBound;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 360;
    const shadowRes = isSoftwareGl ? 1024 : quality.shadowMapSize;
    sunLight.shadow.mapSize.set(shadowRes, shadowRes);
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.018;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-90, 60, -80);
    scene.add(rimLight);

    // 4. Camera (Far clipping plane extended to 3,500m so full OSM city & overhead camera are never clipped)
    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      0.5,
      quality.viewDistance,
    );
    camera.position.set(0, 22, 65);

    // 5. Build Myitkyina Open World Entities
    const terrainMesh = createMyitkyinaTerrainMesh();
    scene.add(terrainMesh);

    const { mesh: waterMesh, updateWater } = createAyeyarwadyWaterMesh(isSoftwareGl);
    scene.add(waterMesh);

    const { group: manauGroup, drums: manauDrums } = createManauParkComplex(renderer);
    scene.add(manauGroup);

    // 1:1 map: Balaminhtin Bridge is ~5 km north of the 3 km play area, so the quest's
    // checkpoints sit on Strand Road instead (variable name kept for save compatibility).
    const { group: bridgeGroup, checkpoints: bridgeCheckpoints } = createStrandRoadCheckpoints();
    scene.add(bridgeGroup);

    const pagodaGroup = createSutaungpyaePagoda();
    scene.add(pagodaGroup);

    // The hand-built fictional downtown is replaced by real OSM buildings at 1:1;
    // kept as an empty group so the existing visibility toggles still work.
    const downtownGroup = new THREE.Group();

    // Station porter quest marker: a glowing suitcase on a ring at the current stop
    const stationMarker = new THREE.Group();
    {
      const caseMat = new THREE.MeshStandardMaterial({
        color: '#b45309',
        emissive: '#f59e0b',
        emissiveIntensity: 0.55,
        roughness: 0.5,
      });
      const suitcase = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.32), caseMat);
      suitcase.position.y = 1.1;
      stationMarker.add(suitcase);
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.04, 8, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: '#1e293b' }),
      );
      handle.position.y = 1.43;
      stationMarker.add(handle);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.1, 40),
        new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.12;
      stationMarker.add(ring);
    }
    stationMarker.visible = false;
    scene.add(stationMarker);
    /** Seconds left to deliver the luggage once picked up (0 = not carrying) */
    let stationTimer = 0;
    /** Active relaxed route and the index of the next stop */
    let scenicRoute: { id: ScenicRouteId; idx: number } | null = null;
    const scenicRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.18, 10, 48),
      new THREE.MeshStandardMaterial({
        color: '#fde68a',
        emissive: '#f59e0b',
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 0.8,
      }),
    );
    scenicRing.visible = false;
    scene.add(scenicRing);
    let stationWarned = false;

    // Myitsone and Jaw Bum are far outside the 3 km map. The peace bell stays as an
    // inert object (rung already) so old save data keeps loading.
    const peaceBell = { x: 1e6, z: 1e6, rung: true };

    // Famous Real-World Myitkyina Shops, Restaurants, Hotels & University Buildings
    const famousBuildingsGroup = createFamousMyitkyinaBuildings(renderer);
    scene.add(famousBuildingsGroup);

    // Mini-3D Paved Main Roads, Side Streets, Lush Green Grass Lawns & Working 3D Traffic Lights
    const {
      group: mini3DRoadsGroup,
      roadMaterials,
      updateTrafficLights,
    } = createMini3DRoadsAndTrafficLights();
    scene.add(mini3DRoadsGroup);

    // Atmospheric Sky Dome, Volumetric Clouds, Streetlamps & Dynamic Weather (Clear / Mist / Rain)
    const { group: skyWeatherGroup, updateWeather } = createSkyAndWeatherSystem(
      renderer,
      roadMaterials,
    );
    scene.add(skyWeatherGroup);

    // Living City Autonomous AI Traffic (AIMA E-Bikes, Toyota Crown Sedans, Tuk-Tuks)
    const {
      group: aiTrafficGroup,
      agents: aiTrafficAgents,
      updateTraffic,
    } = createLivingCityTraffic(renderer);
    scene.add(aiTrafficGroup);

    // Living City Kachin NPCs (Manau Festival Dancers & Sitapu Sidewalk Pedestrians)
    const { group: npcGroup, updateNPCs } = createLivingCityNPCs(renderer);
    scene.add(npcGroup);

    // Interactive 3D Mission Markers (Food Delivery & Sitapu Street Time Trial)
    const { group: challengeMarkersGroup, updateMarkers } = createChallengeMarkers();
    scene.add(challengeMarkersGroup);

    // Arcade Gameplay Boosters: 12 Nitro Speed Boost Rings, 10 Golden Treasure Chests & Dragon Shockwave
    const {
      group: arcadeGroup,
      speedRings,
      treasureChests,
      triggerShockwave,
      updateArcadeItems,
    } = createArcadeBoostRingsAndChests();
    scene.add(arcadeGroup);

    // Ayeyarwady Riverbank & Under Balaminhtin Bridge 3D Fishing Piers, Swimming Fish & Floating Bobber
    const {
      group: fishingGroup,
      spots: fishingSpots,
      updateFishingWorld,
    } = createAyeyarwadyFishingSpots();
    scene.add(fishingGroup);

    createInstancedFoliageAndRocks(scene);

    // 5.9 Real Myitkyina OpenStreetMap 3D City Layer (1,123 Extruded 3D Buildings + 2,821 3D Roads)
    const osmContainerGroup = new THREE.Group();
    scene.add(osmContainerGroup);
    const osmDebugContainerGroup = new THREE.Group();
    scene.add(osmDebugContainerGroup);
    let osmColliders: { x: number; z: number; r: number }[] = [];
    let osmUpdateDebugFn:
      | ((
          px: number,
          py: number,
          pz: number,
        ) => {
          nearbyBuildings150m: number;
          nearestRoadName: string;
          nearestRoadDistM: number;
        })
      | null = null;

    // Hero Character
    const hero = createKachinHero(renderer);
    scene.add(hero.group);

    // GTA-Style 3D Ground GPS Waypoint Arrow Ring around Player
    const gpsGroup = new THREE.Group();
    const gpsRing = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.65, 32),
      new THREE.MeshBasicMaterial({
        color: '#10b981',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    gpsRing.rotation.x = -Math.PI / 2;
    gpsRing.position.y = 0.08;
    gpsGroup.add(gpsRing);

    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 2.35);
    arrowShape.lineTo(0.55, 1.55);
    arrowShape.lineTo(-0.55, 1.55);
    arrowShape.closePath();
    const gpsPointer = new THREE.Mesh(
      new THREE.ShapeGeometry(arrowShape),
      new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    gpsPointer.rotation.x = -Math.PI / 2;
    gpsPointer.position.y = 0.1;
    gpsGroup.add(gpsPointer);
    scene.add(gpsGroup);

    // Vehicles in the world (Parked cleanly along Sitapu curbs and driveways, never inside buildings)
    const vehicles: WorldVehicle[] = [
      createPlayableVehicle('veh_ebike_a5pro', 'ebike', 5, 34, Math.PI, isSoftwareGl),
      createPlayableVehicle('veh_ebike_aimaone', 'ebike', -6, 52, Math.PI, isSoftwareGl),
      createPlayableVehicle('veh_hilux_manau', 'hilux4x4', -24, 24, Math.PI, isSoftwareGl),
      createPlayableVehicle('veh_tuktuk_market', 'tuktuk', -62, 58, Math.PI, isSoftwareGl),
      createPlayableVehicle(
        'veh_hilux_bridge',
        'hilux4x4',
        FISHING_SPOTS[0].x - 14,
        FISHING_SPOTS[0].z,
        Math.PI,
        isSoftwareGl,
      ),
      createPlayableVehicle(
        'veh_boat_jetty',
        'riverboat',
        FISHING_SPOTS[1].waterX + 10,
        FISHING_SPOTS[1].waterZ,
        Math.PI,
        isSoftwareGl,
      ),
      createPlayableVehicle(
        'veh_boat_myitsone',
        'riverboat',
        FISHING_SPOTS[2].waterX + 10,
        FISHING_SPOTS[2].waterZ,
        Math.PI,
        isSoftwareGl,
      ),
    ];
    vehicles.forEach((v) => {
      const vy =
        v.type === 'riverboat'
          ? -0.25
          : playableSurfaceHeightAt(v.x, v.z);
      v.group.position.set(v.x, vy, v.z);
      v.group.rotation.y = v.heading;
      scene.add(v.group);
    });

    // Hide free treasure chests from the map (Player must earn MMK from jobs!)
    treasureChests.forEach((ch) => {
      ch.opened = true;
      ch.respawnTimer = 999999;
      ch.group.visible = false;
    });

    // Smuggler Enemy Hazards
    const enemies = createSmugglerEnemies();
    enemies.forEach((e) => scene.add(e.group));

    // Pooled Burst Particles
    const particlePool: {
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
    }[] = [];
    const partGeo = new THREE.OctahedronGeometry(0.22, 0);
    for (let i = 0; i < 24; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: '#10b981', transparent: true, opacity: 0 });
      const pMesh = new THREE.Mesh(partGeo, pMat);
      pMesh.visible = false;
      scene.add(pMesh);
      particlePool.push({ mesh: pMesh, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 0.6 });
    }

    const spawnBurst = (x: number, y: number, z: number, hexColor: string, count = 10) => {
      let spawned = 0;
      for (const p of particlePool) {
        if (p.life <= 0 && spawned < count) {
          p.mesh.visible = true;
          p.mesh.position.set(x, y, z);
          (p.mesh.material as THREE.MeshBasicMaterial).color.set(hexColor);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 6;
          p.vx = Math.cos(angle) * speed;
          p.vz = Math.sin(angle) * speed;
          p.vy = 3.5 + Math.random() * 5.5;
          p.maxLife = 0.45 + Math.random() * 0.25;
          p.life = p.maxLife;
          spawned++;
        }
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 6. Mutable Simulation State (GTA-Style Decoupled Camera Yaw vs Player Heading!)
    const sim = {
      phase: 'title' as GamePhase,
      health: 100,
      maxHealth: 100,
      stamina: 100,
      jadeCount: 50000, // Player starts with 50,000 MMK ONLY and must earn MMK from jobs!
      score: 0,
      meritLevel: 1,
      comboCount: 0,
      comboTimer: 0,
      playerX: 0,
      playerY: playableSurfaceHeightAt(0, 36),
      playerZ: 36,
      playerVx: 0,
      playerVz: 0,
      playerVy: 0,
      playerHeading: Math.PI, // Facing North (-Z) toward Sitapu Manau Totems (0, 0)
      cameraYaw: Math.PI,
      cameraYawTarget: Math.PI,
      cameraPitch: 0.36, // Comfortable Mini-3D over-the-shoulder elevation angle
      manualLookCooldown: 0,
      isGrounded: true,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      attackCooldown: 0,
      slashAnimTimer: 0,
      squashY: 1,
      activeVehicle: null as WorldVehicle | null,
      hitstopTimer: 0,
      timeOfDay: 'morning' as TimeOfDay,
      weather: 'clear' as WeatherMode,
      activeChallenge: null as ActiveChallengeState | null,
      cameraMode: 'chase' as CameraMode,
      quests: INITIAL_QUESTS.map((q) => ({ ...q })),
      activeQuestIndex: 0,
      virtualStickX: 0,
      virtualStickY: 0,
      smoothRight: 0,
      smoothForward: 0,
      virtualSprint: false,
      virtualJumpHeld: false,
      virtualThrottle: 0, // +1 Gas pedal, -1 Reverse/Brake pedal
      isManauDancing: false,
      danceRewardTimer: 0,
      rhythmStepIndex: 0,
      rhythmBeatTimer: 0,
      rhythmBeatDuration: 1.68, // Synced with 8 steps of 210ms Kachin Manau Groove
      rhythmHitsCompleted: 0,
      rhythmHitsGoal: 8,
      rhythmStreak: 0,
      rhythmCuePlayed: false,
      rhythmLastRating: null as ManauHitRating,
      rhythmLastRatingTextMm: 'တေးသံစဉ် စည်းချက်အလိုက် ခလုတ်နှိပ်ပါ!',
      rhythmPoseKey: null as ManauBeatKey | null,
      rhythmPoseTimer: 0,
      // Ayeyarwady Riverbank & Under Balaminhtin Bridge Fishing + Fish Shop Economy State
      isFishing: false,
      activeFishingSpot: FISHING_SPOTS[0] as FishingSpotNode,
      fishingPhase: 'no_gear' as FishingPhase,
      fishingRodLevel: 0 as FishingRodLevel, // Starts at 0 -> Must buy Level 1 Budget Bamboo Gear (30,000 MMK) before fishing!
      fishingTimer: 0,
      fishingFishPos: 50,
      fishingFishTarget: 50,
      fishingFishTargetTimer: 0,
      fishingBarPos: 50,
      fishingReelProgress: 30,
      fishingReelHeld: false,
      fishingCurrentSpec: AYEYARWADY_FISH_CATALOG[0],
      fishingTotalCaught: 0,
      fishingTotalSold: 0,
      fishingTotalEarnedMmk: 0,
      fishingBiggestKg: 0,
      fishingLastCatch: null as FishCatchInfo | null,
      fishingBasket: [] as FishCatchInfo[],
      fishingCaughtSpecies: [] as string[],
      fishingMessageMm:
        '🛒 ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!',
      customWaypoint: null as { x: number; z: number; labelMm: string } | null,
      osmLoaded: false,
      osmVisible: true,
      osmDebugMode: false,
      osmSourceName: 'Myitkyina OpenStreetMap (export.geojson)',
      osmBuildingsCount: 0,
      osmRoadsCount: 0,
      osmNearbyBuildings150m: 2,
      osmNearestRoadName: 'Pyi Htaung Su Road (ပြည်ထောင်စုလမ်းမကြီး)',
      osmNearestRoadDistM: 12,
      osmBbox: {
        minLat: 25.3448,
        maxLat: 25.4253,
        minLng: 97.3537,
        maxLng: 97.4456,
        minX: -855.9,
        maxX: 660.7,
        minZ: -422.1,
        maxZ: 1028.5,
      } as Osm3DStats['bbox'],
      osmCitySpawnPoints: DEFAULT_OSM_CITY_SPAWNS as OsmCitySpawnPoint[],
      osmCitySpawnIndex: 0,
      osmNamedPlaces: [] as OsmNamedPlace[],
      osmRoadPolylines: [] as OsmRoadPolyline[],
      osmBuildingFootprints: [] as OsmBuildingFootprint[],
      activeNpcDialogue: null as {
        npc: InteractiveNpcInfo;
        currentReplyMm: string;
      } | null,
      npcClaimedBonusIds: [] as string[],
      notification: {
        title: '🏙️ မြစ်ကြီးနား OpenStreetMap 3D မြို့ပြမြေပုံနှင့် NPC စနစ် အသင့်ရှိသည်!',
        subtitle:
          '[🏙️ မြို့လယ်သို့သွားမည်] သို့မဟုတ် [🛰️ အပေါ်စီးကင်မရာ] နှိပ်၍ OSM အဆောက်အအုံ (၁,၁၂၃) လုံးနှင့် လမ်း (၂,၈၂၁) သွယ်ကို ကြည့်ရှုပါ!',
        timestamp: performance.now(),
      } as { title: string; subtitle: string; timestamp: number } | null,
    };

    _smoothLookAt.set(sim.playerX, sim.playerY + 1.8, sim.playerZ);

    const showBanner = (title: string, subtitle: string) => {
      sim.notification = { title, subtitle, timestamp: performance.now() };
    };

    const openNpcInteractionModal = (npc: InteractiveNpcInfo) => {
      sim.activeNpcDialogue = {
        npc,
        currentReplyMm: npc.greetingMm,
      };
      soundEngine.playJadeCollect(2);
      showBanner(
        `💬 ${npc.nameMm} (${npc.roleLabelMm})`,
        'စကားပြောဆိုရန် သို့မဟုတ် အရောင်းအဝယ်လုပ်ရန် ရွေးချယ်ပါ',
      );
    };

    const loadOsmGeoJsonInto3D = (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geojsonData: any,
      sourceLabel: string,
      announce = false,
    ) => {
      while (osmContainerGroup.children.length > 0) {
        const child = osmContainerGroup.children[0];
        osmContainerGroup.remove(child);
      }
      while (osmDebugContainerGroup.children.length > 0) {
        const child = osmDebugContainerGroup.children[0];
        osmDebugContainerGroup.remove(child);
      }
      const built = buildMyitkyinaOsm3DGroup(geojsonData, renderer);
      osmContainerGroup.add(built.group);
      osmContainerGroup.visible = sim.osmVisible;
      mini3DRoadsGroup.visible = !sim.osmVisible;
      downtownGroup.visible = !sim.osmVisible;
      built.debugGroup.visible = sim.osmDebugMode;
      osmDebugContainerGroup.add(built.debugGroup);
      osmColliders = built.colliders;
      osmUpdateDebugFn = built.updateDebugOverlay;
      sim.osmLoaded = true;
      sim.osmSourceName = sourceLabel;
      sim.osmBuildingsCount = built.buildingsCount;
      sim.osmRoadsCount = built.roadsCount;
      sim.osmBbox = built.bbox;
      sim.osmCitySpawnPoints = built.citySpawnPoints;
      sim.osmNamedPlaces = built.namedPlaces;
      sim.osmRoadPolylines = built.roadPolylines;
      sim.osmBuildingFootprints = built.buildingFootprints;

      const initialDiag = built.updateDebugOverlay(sim.playerX, sim.playerY, sim.playerZ);
      sim.osmNearbyBuildings150m = initialDiag.nearbyBuildings150m;
      sim.osmNearestRoadName = initialDiag.nearestRoadName;
      sim.osmNearestRoadDistM = initialDiag.nearestRoadDistM;

      if (announce) {
        soundEngine.playQuestComplete();
        showBanner(
          `🏙️ OpenStreetMap 3D ပြောင်းလဲမှု အောင်မြင်ပြီ! (${sourceLabel})`,
          `3D အဆောက်အအုံ (${built.buildingsCount.toLocaleString()}) လုံး · 3D လမ်း (${built.roadsCount.toLocaleString()}) သွယ် · [🏙️ မြို့လယ်သို့သွားမည်] နှိပ်ပါ!`,
        );
      }
    };

    // Fetch and convert the user's Myitkyina OpenStreetMap dataset (/assets/aistudio/export.geojson) into 3D
    fetch(`${import.meta.env.BASE_URL}assets/map/myitkyina-core.geojson`)
      .then((res) => (res.ok ? res.json() : null))
      .then((geojsonData) => {
        if (!geojsonData || isDisposed) return;
        loadOsmGeoJsonInto3D(geojsonData, 'Myitkyina OSM (export.geojson)', false);
      })
      .catch(() => {
        // Ignore if offline or missing
      });

    const stopFishingMode = (silent = false) => {
      if (!sim.isFishing) return;
      sim.isFishing = false;
      sim.fishingReelHeld = false;
      sim.fishingPhase = sim.fishingRodLevel === 0 ? 'no_gear' : 'ready';
      hero.fishingRodMesh.visible = false;
      hero.bladeMesh.visible = !sim.isManauDancing;
      hero.leftArm.rotation.set(0, 0, 0);
      hero.rightArm.rotation.set(0, 0, 0);
      if (!silent) {
        showBanner(
          '🎣 ငါးမျှားခြင်း ရပ်နားပြီး ခြေလျင်မုဒ်သို့ ပြန်ပြောင်းသည်',
          sim.fishingBasket.length > 0
            ? `🐟 ငါးပလိုင်းထဲတွင် ငါး (${sim.fishingBasket.length}) ကောင် ရှိသည် — ငါးအဝယ်ဒိုင်တွင် ရောင်းချပါ!`
            : 'Returned to Free Exploration',
        );
      }
    };

    const castFishingLine = () => {
      if (sim.fishingRodLevel === 0) {
        sim.fishingPhase = 'no_gear';
        sim.fishingMessageMm =
          '🛒 ငါးမျှားတံ မရှိသေးပါ! အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!';
        hero.fishingRodMesh.visible = false;
        showBanner(
          '🛒 ငါးမျှားကိရိယာ အရင်ဝယ်ယူပါ (30,000 MMK)',
          'သင့်လက်ကျန်ငွေ 50,000 MMK ဖြင့် အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ဝယ်ယူပြီးမှ ငါးမျှားနိုင်ပါမည်!',
        );
        return;
      }

      hero.fishingRodMesh.visible = true;
      sim.fishingPhase = 'waiting';
      // Upgraded rods attract fish slightly faster!
      const waitReduction = (sim.fishingRodLevel - 1) * 0.25;
      sim.fishingTimer = Math.max(0.9, 1.5 - waitReduction + Math.random() * 1.5);
      sim.fishingReelProgress = 26 + sim.fishingRodLevel * 4;
      sim.fishingBarPos = 50;
      sim.fishingFishPos = 45;
      sim.fishingMessageMm =
        '🌊 ဧရာဝတီမြစ်ရေပြင်တွင် ငါးဟပ်မည့်အချိန် စောင့်ဆိုင်းနေသည်... (ဖော့တုံးလှုပ်လျှင် နှိပ်ပါ!)';
      soundEngine.playSplash(false);
      spawnBurst(
        sim.activeFishingSpot.waterX,
        0.1,
        sim.activeFishingSpot.waterZ,
        '#38bdf8',
        12,
      );
    };

    const buyOrUpgradeFishingGear = () => {
      if (sim.fishingRodLevel >= 3) {
        showBanner(
          '🏆 အမြင့်ဆုံး ပရို ဧရာဝတီ ရွှေငါးမျှားစက် (Lv.3) ပိုင်ဆိုင်ထားပြီးဖြစ်သည်!',
          'Maximum Fishing Gear Level Reached (2.5x Fish Earnings!)',
        );
        return;
      }

      const nextLevel = (sim.fishingRodLevel + 1) as FishingRodLevel;
      const nextTier = FISHING_GEAR_TIERS[nextLevel];
      if (sim.jadeCount < nextTier.priceMmk) {
        soundEngine.playDamageTaken();
        showBanner(
          `❌ ငွေမလုံလောက်ပါ! လိုအပ်ငွေ: ${nextTier.priceMmk.toLocaleString()} MMK`,
          `လက်ရှိငွေ: ${sim.jadeCount.toLocaleString()} MMK — ဖမ်းမိသောငါးများ ရောင်းချခြင်း သို့မဟုတ် အလုပ်မစ်ရှင်လုပ်၍ ငွေရှာပါ!`,
        );
        return;
      }

      sim.jadeCount -= nextTier.priceMmk;
      sim.fishingRodLevel = nextLevel;
      soundEngine.playQuestComplete();
      triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, '#fbbf24');
      spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#fbbf24', 20);

      showBanner(
        `🎣 ${nextTier.nameMm} ဝယ်ယူ/အဆင့်မြှင့်တင်ပြီး! (-${nextTier.priceMmk.toLocaleString()} MMK)`,
        `${nextTier.capabilityMm} · လက်ကျန်ငွေ: ${sim.jadeCount.toLocaleString()} MMK`,
      );

      // If currently at the fishing pier waiting for gear, immediately equip rod and cast line!
      if (sim.isFishing) {
        hero.fishingRodMesh.visible = true;
        castFishingLine();
      } else {
        sim.fishingPhase = 'ready';
        sim.fishingMessageMm = `✅ ${nextTier.nameMm} အသင့်ရှိသည်! ငါးမျှားတံပစ်ချရန် နှိပ်ပါ!`;
      }
    };

    const sellCaughtFish = () => {
      if (sim.fishingBasket.length === 0) {
        soundEngine.playDamageTaken();
        showBanner(
          '🐟 ငါးပလိုင်းထဲတွင် ရောင်းစရာ ငါးမရှိသေးပါ!',
          'ဧရာဝတီ ကမ်းနား ငါးမျှားဆိပ်တွင် ငါးအရင်ဖမ်းပါ!',
        );
        return;
      }

      const soldCount = sim.fishingBasket.length;
      const totalMmk = sim.fishingBasket.reduce((sum, f) => sum + f.priceMmk, 0);
      sim.jadeCount += totalMmk;
      sim.fishingTotalSold += soldCount;
      sim.fishingTotalEarnedMmk += totalMmk;
      sim.score += Math.round(totalMmk / 25);
      sim.fishingBasket = [];

      soundEngine.playQuestComplete();
      soundEngine.playJadeCollect(Math.min(6, soldCount + 2));
      triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, '#10b981');
      spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#10b981', 22);

      // Progress quest_fishing when fish are sold to the Fish Shop!
      const qFish = sim.quests.find((q) => q.id === 'quest_fishing');
      if (qFish && !qFish.completed) {
        qFish.progress = Math.min(qFish.goal, sim.fishingTotalSold);
        if (qFish.progress >= qFish.goal) {
          qFish.completed = true;
          sim.jadeCount += qFish.rewardJade;
          sim.score += 800;
          showBanner(
            `🏆 ငါးဖမ်း/ငါးရောင်း မစ်ရှင် အောင်မြင်ပြီ! (+${(totalMmk + qFish.rewardJade).toLocaleString()} MMK)`,
            `ငါး (${soldCount}) ကောင် ရောင်းရငွေ ${totalMmk.toLocaleString()} MMK + မစ်ရှင်ဆုကြေး ${qFish.rewardJade.toLocaleString()} MMK ရရှိသည်!`,
          );
          sim.fishingMessageMm = `💰 ငါး (${soldCount}) ကောင် ရောင်းချပြီး! စုစုပေါင်း +${(totalMmk + qFish.rewardJade).toLocaleString()} MMK ရရှိသည်!`;
          return;
        }
      }

      sim.fishingMessageMm = `💰 ငါးအဝယ်ဒိုင်သို့ ငါး (${soldCount}) ကောင် ရောင်းချပြီး! (+${totalMmk.toLocaleString()} MMK ရရှိသည်)`;
      showBanner(
        `💰 ဧရာဝတီ ငါးအဝယ်ဒိုင်သို့ ငါး (${soldCount}) ကောင် ရောင်းချပြီး!`,
        `ရောင်းရငွေ +${totalMmk.toLocaleString()} MMK · လက်ရှိငွေ: ${sim.jadeCount.toLocaleString()} MMK`,
      );
    };

    const startFishingAtSpot = (spotId?: string) => {
      if (sim.phase !== 'playing') sim.phase = 'playing';
      if (sim.isManauDancing) {
        sim.isManauDancing = false;
        hero.leftFanMesh.visible = false;
        hero.rightFanMesh.visible = false;
      }
      if (sim.activeVehicle) {
        sim.activeVehicle.group.rotation.z = 0;
        sim.activeVehicle = null;
      }

      let chosenSpot = FISHING_SPOTS[0];
      if (spotId) {
        chosenSpot = FISHING_SPOTS.find((s) => s.id === spotId) || FISHING_SPOTS[0];
      } else {
        let bestD = Infinity;
        for (const s of FISHING_SPOTS) {
          const d = Math.hypot(sim.playerX - s.x, sim.playerZ - s.z);
          if (d < bestD) {
            bestD = d;
            chosenSpot = s;
          }
        }
        // If player isn't near any pier yet, default to Under Balaminhtin Bridge Pier!
        if (bestD > 35) {
          chosenSpot = FISHING_SPOTS[0];
        }
      }

      sim.activeFishingSpot = chosenSpot;
      sim.isFishing = true;
      sim.playerX = chosenSpot.x + 2.2;
      sim.playerZ = chosenSpot.z;
      sim.playerY = playableSurfaceHeightAt(chosenSpot.x, chosenSpot.z) + 0.36;
      sim.playerVx = 0;
      sim.playerVz = 0;
      sim.playerHeading = Math.PI / 2; // Facing East (+X) toward the Ayeyarwady River
      sim.cameraYaw = Math.PI / 2 - 0.35;
      sim.cameraYawTarget = Math.PI / 2 - 0.35;
      _smoothLookAt.set(sim.playerX + 5, sim.playerY + 1.2, sim.playerZ);

      hero.group.visible = true;
      hero.group.rotation.z = 0;
      hero.bladeMesh.visible = false;
      hero.leftFanMesh.visible = false;
      hero.rightFanMesh.visible = false;
      hero.fishingRodMesh.visible = sim.fishingRodLevel > 0;

      if (sim.fishingRodLevel === 0) {
        sim.fishingPhase = 'no_gear';
        sim.fishingMessageMm =
          '🛒 ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!';
        showBanner(
          `🎣 ${chosenSpot.nameMm} — ငါးမျှားတံ လိုအပ်ပါသည်`,
          'သင့်လက်ကျန်ငွေ 50,000 MMK မှ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!',
        );
      } else {
        castFishingLine();
        showBanner(
          `🎣 ${chosenSpot.nameMm}`,
          `${FISHING_GEAR_TIERS[sim.fishingRodLevel].nameMm} ဖြင့် ငါးမျှားတံ ပစ်ချထားပြီ!`,
        );
      }
    };

    const handleFishingActionTap = () => {
      if (!sim.isFishing) {
        startFishingAtSpot();
        return;
      }

      if (sim.fishingRodLevel === 0 || sim.fishingPhase === 'no_gear') {
        buyOrUpgradeFishingGear();
        return;
      }

      if (sim.fishingPhase === 'ready' || sim.fishingPhase === 'caught') {
        castFishingLine();
        return;
      }

      if (sim.fishingPhase === 'waiting') {
        // Pulled too early -> re-cast immediately so player isn't stuck
        soundEngine.playSplash(false);
        sim.fishingTimer = 1.2 + Math.random() * 1.4;
        sim.fishingMessageMm =
          '⏱ စောလွန်းသည်! ဖော့တုံး ခုန်လှုပ်ပြီး "ငါးဟပ်နေပြီ!" ပြမှ နှိပ်ပါ!';
        return;
      }

      if (sim.fishingPhase === 'bite') {
        // Hooked the fish! Roll species based on Fishing Gear Level + Spot Multiplier!
        // Lv.1 Budget Rod catches mostly common fish; Lv.2 & Lv.3 unlock bigger rare & legendary fish!
        const gearBonus = (sim.fishingRodLevel - 1) * 0.32;
        const roll = Math.random() * sim.activeFishingSpot.bonusMultiplier + gearBonus;
        let pool = AYEYARWADY_FISH_CATALOG.filter((f) => f.rarity === 'common');
        if (sim.fishingRodLevel >= 2 && roll > 1.15) {
          pool = AYEYARWADY_FISH_CATALOG.filter((f) => f.rarity === 'legendary');
        } else if (roll > (sim.fishingRodLevel === 1 ? 0.82 : 0.52)) {
          pool = AYEYARWADY_FISH_CATALOG.filter((f) => f.rarity === 'rare');
        }
        sim.fishingCurrentSpec =
          pool[Math.floor(Math.random() * pool.length)] || AYEYARWADY_FISH_CATALOG[0];

        sim.fishingPhase = 'reeling';
        sim.fishingBarPos = 50;
        sim.fishingFishPos = 42 + Math.random() * 16;
        sim.fishingFishTarget = 20 + Math.random() * 60;
        sim.fishingFishTargetTimer = 0.65;
        sim.fishingReelProgress = 28 + sim.fishingRodLevel * 5;
        sim.fishingMessageMm = `🐟 ${sim.fishingCurrentSpec.nameMm} ချိတ်မိပြီ! [ဖိထား၍ ဆွဲတင်ပါ] ခလုတ်ဖြင့် အစိမ်းရောင်ဘောင်ထဲ ငါးကို ထိန်းထားပါ!`;
        soundEngine.playSplash(true);
        spawnBurst(
          sim.activeFishingSpot.waterX,
          0.3,
          sim.activeFishingSpot.waterZ,
          '#fbbf24',
          16,
        );
        return;
      }

      if (sim.fishingPhase === 'reeling') {
        // Tapping during reeling also nudges the green bar upward for easy tap-or-hold play!
        sim.fishingBarPos = Math.min(88, sim.fishingBarPos + 14);
      }
    };

    const setManauDanceState = (dancing: boolean) => {
      if (dancing) {
        if (sim.isFishing) {
          stopFishingMode(true);
        }
        if (sim.activeVehicle) {
          sim.activeVehicle.group.rotation.z = 0;
          sim.activeVehicle = null;
        }
        // If player is far from Manau Park, bring them into the Manau Festival Plaza circle!
        if (Math.hypot(sim.playerX, sim.playerZ) > 42) {
          sim.playerX = 0;
          sim.playerZ = 14;
          sim.playerY = playableSurfaceHeightAt(0, 14);
          _smoothLookAt.set(0, sim.playerY + 1.8, 14);
        }
        sim.isManauDancing = true;
        sim.danceRewardTimer = 0;
        sim.rhythmBeatTimer = 0.25;
        sim.rhythmCuePlayed = false;
        sim.rhythmLastRating = null;
        const currentKey = MANAU_DANCE_PATTERN[sim.rhythmStepIndex % MANAU_DANCE_PATTERN.length];
        sim.rhythmLastRatingTextMm = `စည်းချက်အလိုက် ${MANAU_BEAT_LABELS_MM[currentKey]} ခလုတ်ကို နှိပ်ပါ!`;
        hero.group.visible = true;
        hero.group.rotation.z = 0;
        hero.bladeMesh.visible = false;
        hero.fishingRodMesh.visible = false;
        hero.leftFanMesh.visible = true;
        hero.rightFanMesh.visible = true;

        // Play Traditional Kachin Manau Groove ("မြစ်ကြီးနား မနောမြေ") in sync with the dance!
        if (soundEngine.getCurrentTrack() === 'off') {
          soundEngine.playMusicTrack('sample1');
        }
        soundEngine.playManauGong();
        triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, '#facc15');
        spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#facc15', 18);
        showBanner(
          '💃 စီတာပူ မနောပွဲတော် ရိုးရာမနောအက သံစဉ်မစ်ရှင် စတင်ပြီ!',
          'ကချင်ရိုးရာတေးသံစဉ် စည်းချက်အလိုက် အောက်ခြေရှိ ခလုတ် (◀ / ▲ / ▼ / ▶) တို့ကို အချိန်မီနှိပ်ပါ!',
        );
      } else if (sim.isManauDancing) {
        sim.isManauDancing = false;
        sim.rhythmPoseKey = null;
        sim.rhythmPoseTimer = 0;
        hero.bladeMesh.visible = true;
        hero.leftFanMesh.visible = false;
        hero.rightFanMesh.visible = false;
        hero.leftArm.rotation.set(0, 0, 0);
        hero.rightArm.rotation.set(0, 0, 0);
        showBanner('မနောအက ရပ်နားပြီး ခြေလျင်မုဒ်သို့ ပြန်ပြောင်းသည်', 'Normal Exploration Mode');
      }
    };

    const handleManauRhythmPress = (pressedKey: ManauBeatKey) => {
      if (sim.phase !== 'playing') return;
      if (!sim.isManauDancing) {
        setManauDanceState(true);
      }

      const expectedKey = MANAU_DANCE_PATTERN[sim.rhythmStepIndex % MANAU_DANCE_PATTERN.length];
      const progress = sim.rhythmBeatTimer / sim.rhythmBeatDuration;

      if (pressedKey === expectedKey && progress >= 0.22) {
        const isPerfect = progress >= 0.55 && progress <= 0.98;
        const rating: ManauHitRating = isPerfect ? 'PERFECT' : 'GOOD';
        sim.rhythmLastRating = rating;
        sim.rhythmStreak += 1;
        sim.rhythmHitsCompleted += 1;
        sim.comboCount = Math.max(sim.comboCount + 1, sim.rhythmStreak);
        sim.comboTimer = 5.0;

        const mmkGain = isPerfect ? 2500 : 1500;
        sim.jadeCount += mmkGain;
        sim.score += isPerfect ? 180 : 110;
        sim.health = Math.min(sim.maxHealth, sim.health + 12);
        sim.stamina = 100;

        sim.rhythmPoseKey = pressedKey;
        sim.rhythmPoseTimer = 0.52;
        sim.squashY = pressedKey === 'up' ? 1.24 : pressedKey === 'down' ? 0.84 : 1.12;

        // Advance to next beat in sequence
        sim.rhythmStepIndex += 1;
        sim.rhythmBeatTimer = 0;
        sim.rhythmCuePlayed = false;

        soundEngine.playRhythmHit(rating, sim.rhythmStreak);
        const burstColor =
          pressedKey === 'left'
            ? '#f59e0b'
            : pressedKey === 'right'
              ? '#10b981'
              : pressedKey === 'up'
                ? '#fde047'
                : '#fb7185';
        triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, burstColor);
        spawnBurst(sim.playerX, sim.playerY + 1.9, sim.playerZ, burstColor, isPerfect ? 16 : 10);

        const nextKey = MANAU_DANCE_PATTERN[sim.rhythmStepIndex % MANAU_DANCE_PATTERN.length];
        sim.rhythmLastRatingTextMm = isPerfect
          ? `★ PERFECT! အထူးမှန်ကန်သည် (+${mmkGain.toLocaleString()} MMK) · နောက်တစ်ချက်: ${MANAU_BEAT_LABELS_MM[nextKey]}`
          : `✓ GOOD! စည်းချက်မှန်သည် (+${mmkGain.toLocaleString()} MMK) · နောက်တစ်ချက်: ${MANAU_BEAT_LABELS_MM[nextKey]}`;

        // Progress quest_manau_rhythm (and also quest_manau if still active)
        const qRhythm = sim.quests.find((q) => q.id === 'quest_manau_rhythm');
        if (qRhythm && !qRhythm.completed) {
          qRhythm.progress = Math.min(qRhythm.goal, sim.rhythmHitsCompleted);
          if (qRhythm.progress >= qRhythm.goal) {
            qRhythm.completed = true;
            sim.jadeCount += qRhythm.rewardJade;
            sim.score += 650;
            soundEngine.playManauGong();
            soundEngine.playQuestComplete();
            triggerShockwave(0, playableSurfaceHeightAt(0, 0), 0, '#fbbf24');
            spawnBurst(0, playableSurfaceHeightAt(0, 0) + 4.0, 0, '#fbbf24', 24);
            showBanner(
              `🎉 မနောအက သံစဉ်ချက် (၈) ချက် မစ်ရှင် အောင်မြင်ပြီ! (+${qRhythm.rewardJade.toLocaleString()} MMK)`,
              'Manau Rhythm Dance Quest Completed! Sacred Manau Blessing Awarded!',
            );
          } else {
            showBanner(
              `💃 မနောအက သံစဉ်ချက် (${qRhythm.progress}/${qRhythm.goal}) — ${rating}!`,
              `+${mmkGain.toLocaleString()} MMK (${sim.rhythmStreak}x Streak) · နောက်တစ်ချက်: ${MANAU_BEAT_LABELS_MM[nextKey]}`,
            );
          }
        } else {
          showBanner(
            `💃 မနောအက ${rating}! (+${mmkGain.toLocaleString()} MMK · ${sim.rhythmStreak}x Streak)`,
            `နောက်တစ်ချက်: ${MANAU_BEAT_LABELS_MM[nextKey]}`,
          );
        }
      } else {
        sim.rhythmLastRating = 'MISS';
        sim.rhythmStreak = 0;
        soundEngine.playRhythmHit('MISS', 0);
        sim.rhythmLastRatingTextMm =
          pressedKey !== expectedKey
            ? `✕ ခလုတ်လွဲသွားသည်! ${MANAU_BEAT_LABELS_MM[expectedKey]} ကို နှိပ်ပါ`
            : `⏱ စောလွန်းသည်! ရွှေရောင်စက်ဝိုင်းထဲ ရောက်မှ ${MANAU_BEAT_LABELS_MM[expectedKey]} နှိပ်ပါ`;
      }
    };

    // Solid AABB collision against all Famous Buildings so player & vehicles never clip inside walls
    const resolveBuildingCollision = (
      x: number,
      z: number,
      radius: number,
    ): { x: number; z: number; hit: boolean } => {
      let outX = x;
      let outZ = z;
      let hit = false;
      for (const b of MYITKYINA_FAMOUS_BUILDINGS) {
        const extraW = b.roofShape === 'colonnade' ? 7.5 : 0;
        const halfW = b.width * 0.5 + extraW + radius;
        const halfD = b.depth * 0.5 + radius;
        const dx = outX - b.x;
        const dz = outZ - b.z;
        if (Math.abs(dx) < halfW && Math.abs(dz) < halfD) {
          hit = true;
          const penX = halfW - Math.abs(dx);
          const penZ = halfD - Math.abs(dz);
          if (penX < penZ) {
            outX = b.x + (dx >= 0 ? halfW : -halfW);
          } else {
            outZ = b.z + (dz >= 0 ? halfD : -halfD);
          }
        }
      }
      // Also check collision against larger 3D OpenStreetMap buildings when OSM 3D layer is visible
      if (sim.osmVisible && osmColliders.length > 0) {
        for (let i = 0; i < osmColliders.length; i++) {
          const c = osmColliders[i];
          const dx = outX - c.x;
          const dz = outZ - c.z;
          const minDist = c.r + radius;
          if (Math.abs(dx) < minDist && Math.abs(dz) < minDist) {
            const dist = Math.hypot(dx, dz);
            if (dist < minDist && dist > 0.001) {
              hit = true;
              const push = (minDist - dist) / dist;
              outX += dx * push;
              outZ += dz * push;
            }
          }
        }
      }
      return { x: outX, z: outZ, hit };
    };

    // 7. Input Handling (Multi-Touch Safe, Low-Sensitivity Smooth Camera Look)
    const heldKeys: Record<string, boolean> = {};
    let isPointerDragging = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let activeLookTouchId: number | null = null;
    let prevTouchX = 0;
    let prevTouchY = 0;

    const clearHeldInputs = () => {
      Object.keys(heldKeys).forEach((k) => {
        heldKeys[k] = false;
      });
      sim.virtualStickX = 0;
      sim.virtualStickY = 0;
      sim.smoothRight = 0;
      sim.smoothForward = 0;
      sim.virtualSprint = false;
      sim.virtualJumpHeld = false;
      sim.virtualThrottle = 0;
      sim.fishingReelHeld = false;
      isPointerDragging = false;
      activeLookTouchId = null;
    };

    const triggerInteractOrAttack = () => {
      if (sim.phase !== 'playing') return;

      // 0. If currently in Fishing Mini-Game, tapping action hooks or casts!
      if (sim.isFishing) {
        handleFishingActionTap();
        return;
      }

      // 0.25 Check nearby Interactive NPCs (Shopkeeper, Quest Giver, Regular Citizen)
      for (const npc of MYITKYINA_INTERACTIVE_NPCS) {
        if (Math.hypot(sim.playerX - npc.x, sim.playerZ - npc.z) < 8.5) {
          openNpcInteractionModal(npc);
          return;
        }
      }

      // 0.5 Check nearby Ayeyarwady / Balaminhtin Bridge Fishing Piers
      for (const spot of fishingSpots) {
        if (Math.hypot(sim.playerX - spot.x, sim.playerZ - spot.z) < 12.5) {
          startFishingAtSpot(spot.id);
          return;
        }
      }

      // 1. Check nearby Manau Drum activation
      for (const drum of manauDrums) {
        if (!drum.activated && Math.hypot(sim.playerX - drum.x, sim.playerZ - drum.z) < 5.5) {
          drum.activated = true;
          (drum.ringMesh.material as THREE.MeshStandardMaterial).color.set('#10b981');
          (drum.ringMesh.material as THREE.MeshStandardMaterial).emissive.set('#059669');
          soundEngine.playManauGong();
          spawnBurst(drum.x, groundHeightAt(drum.x, drum.z) + 1.8, drum.z, '#f59e0b', 12);

          const qManau = sim.quests.find((q) => q.id === 'quest_manau');
          if (qManau && !qManau.completed) {
            qManau.progress = Math.min(qManau.goal, qManau.progress + 1);
            sim.score += 150;
            if (qManau.progress >= qManau.goal) {
              qManau.completed = true;
              sim.jadeCount += qManau.rewardJade;
              sim.score += 500;
              soundEngine.playQuestComplete();
              showBanner(
                'မနောပွဲတော် အောင်မြင်စွာ စတင်ပြီ!',
                `Manau Festival Awakened! +${qManau.rewardJade.toLocaleString()} MMK`,
              );
            } else {
              showBanner(
                `မနောစည်တော် (${qManau.progress}/${qManau.goal}) တီးခတ်ပြီး`,
                'Sacred Manau Drum Resonates Across Myitkyina',
              );
            }
          }
          return;
        }
      }

      // 2. Check Jaw Bum Peace Bell
      if (
        !peaceBell.rung &&
        Math.hypot(sim.playerX - peaceBell.x, sim.playerZ - peaceBell.z) < 6.8
      ) {
        peaceBell.rung = true;
        soundEngine.playManauGong();
        soundEngine.playQuestComplete();
        spawnBurst(
          peaceBell.x,
          groundHeightAt(peaceBell.x, peaceBell.z) + 3.0,
          peaceBell.z,
          '#fbbf24',
          14,
        );
        const qBell = sim.quests.find((q) => q.id === 'quest_jawbum');
        if (qBell && !qBell.completed) {
          qBell.progress = 1;
          qBell.completed = true;
          sim.jadeCount += qBell.rewardJade;
          sim.score += 600;
          showBanner(
            'ဂျော်ဘွမ် ငြိမ်းချမ်းရေးခေါင်းလောင်း တီးခတ်အောင်မြင်!',
            `Jaw Bum Highland Peace Bell Rung! +${qBell.rewardJade.toLocaleString()} MMK`,
          );
        }
        return;
      }

      // 2.5 Check nearby Famous Myitkyina Shop / Fish Shop / Restaurant / Hotel / University Interaction
      for (const b of MYITKYINA_FAMOUS_BUILDINGS) {
        if (b.interactPromptMm && Math.hypot(sim.playerX - b.x, sim.playerZ - b.z) < 12.5) {
          if (b.id === 'bldg_fish_shop_sitapu' || b.id === 'bldg_fish_shop_bridge') {
            if (sim.fishingBasket.length > 0) {
              sellCaughtFish();
            } else {
              buyOrUpgradeFishingGear();
            }
            return;
          }
          sim.health = sim.maxHealth;
          sim.stamina = 100;
          sim.score += 50;
          soundEngine.playJadeCollect(4);
          spawnBurst(b.x, playableSurfaceHeightAt(b.x, b.z) + 2.2, b.z, b.accentColor, 14);
          showBanner(
            `${b.nameMm} (${b.nameEn})`,
            b.buffDescriptionMm || 'အားအင်နှင့် အသက် (HP 100%) အပြည့်ပြန်ဖြည့်ပြီး!',
          );
          return;
        }
      }

      // 2.6 Check Sutaungpyae Golden Pagoda Prayer (ဆုတောင်းပြည့်စေတီ ဘုရားဖူး ဆုတောင်းရန်)
      if (Math.hypot(sim.playerX - 68, sim.playerZ - 224) < 18) {
        sim.health = sim.maxHealth;
        sim.stamina = 100;
        sim.score += 250;
        soundEngine.playManauGong();
        soundEngine.playJadeCollect(5);
        triggerShockwave(68, playableSurfaceHeightAt(68, 224), 224, '#fbbf24');
        spawnBurst(sim.playerX, sim.playerY + 2.0, sim.playerZ, '#fbbf24', 18);
        showBanner(
          '🙏 ဆုတောင်းပြည့်စေတီတွင် ရွှေသင်္ကန်းကပ်လှူ ဆုတောင်းပြီး!',
          'ကောင်းချီးမင်္ဂလာနှင့် HP 100% အပြည့် ပြန်လည်ရရှိပါပြီ!',
        );
        return;
      }

      // 2.7 Check Sitapu Manau Park Plaza Dance Interaction (မနောကွင်းတွင် မနောအက ကရန်)
      if (!sim.activeVehicle && Math.hypot(sim.playerX, sim.playerZ - 7) < 22) {
        setManauDanceState(!sim.isManauDancing);
        return;
      }

      // 3. Otherwise perform Kachin Nhtu Dragon Sword Attack (or Vehicle Nitro Turbo Boost)
      if (sim.attackCooldown <= 0) {
        sim.attackCooldown = 0.34;
        sim.slashAnimTimer = 0.24;
        soundEngine.playSwordSlash();
        triggerShockwave(
          sim.playerX,
          sim.playerY,
          sim.playerZ,
          sim.activeVehicle ? '#06b6d4' : '#34d399',
        );

        if (sim.activeVehicle) {
          // Smooth forward Nitro Turbo Boost in vehicle
          const boostAmt = 14 + (sim.meritLevel - 1) * 2.5;
          sim.activeVehicle.speed = Math.min(42, sim.activeVehicle.speed + boostAmt);
          spawnBurst(sim.playerX, sim.playerY + 0.8, sim.playerZ, '#06b6d4', 10);
        } else {
          // Auto-aim toward nearest enemy within 7.5m (GTA melee lock-on!)
          let closestEnemy = null;
          let minEDist = 7.5;
          for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const d = Math.hypot(enemy.x - sim.playerX, enemy.z - sim.playerZ);
            if (d < minEDist) {
              minEDist = d;
              closestEnemy = enemy;
            }
          }
          if (closestEnemy) {
            sim.playerHeading = Math.atan2(
              closestEnemy.x - sim.playerX,
              closestEnemy.z - sim.playerZ,
            );
          }

          const stepDist = 1.5;
          const nextFoot = resolveBuildingCollision(
            sim.playerX + Math.sin(sim.playerHeading) * stepDist,
            sim.playerZ + Math.cos(sim.playerHeading) * stepDist,
            0.85,
          );
          sim.playerX = nextFoot.x;
          sim.playerZ = nextFoot.z;
        }

        const hitRange = 5.5 + (sim.meritLevel - 1) * 1.1;
        const slashDamage = 60 + (sim.meritLevel - 1) * 20;

        for (const enemy of enemies) {
          if (!enemy.alive) continue;
          const dist = Math.hypot(enemy.x - sim.playerX, enemy.z - sim.playerZ);
          if (dist < hitRange) {
            enemy.hp -= slashDamage;
            enemy.hitFlashTimer = 0.16;
            sim.hitstopTimer = 0.04;
            sim.comboCount += 1;
            sim.comboTimer = 5.0;
            soundEngine.playHeavyImpact();
            spawnBurst(enemy.x, groundHeightAt(enemy.x, enemy.z) + 1.3, enemy.z, '#ef4444', 12);

            const kx = enemy.x - sim.playerX;
            const kz = enemy.z - sim.playerZ;
            const kl = Math.hypot(kx, kz) || 1;
            enemy.x += (kx / kl) * 2.8;
            enemy.z += (kz / kl) * 2.8;

            if (enemy.hp <= 0) {
              enemy.alive = false;
              enemy.group.visible = false;
              const bountyMmk = 6000 + sim.comboCount * 1000;
              sim.score += 300;
              sim.jadeCount += bountyMmk;
              const qSmug = sim.quests.find((q) => q.id === 'quest_smugglers');
              if (qSmug && !qSmug.completed) {
                qSmug.progress = Math.min(qSmug.goal, qSmug.progress + 1);
                if (qSmug.progress >= qSmug.goal) {
                  qSmug.completed = true;
                  sim.jadeCount += qSmug.rewardJade;
                  soundEngine.playQuestComplete();
                  showBanner(
                    'ကမ်းနား လုံခြုံရေး အောင်မြင်ပြီ!',
                    `All Rogue Smugglers Cleared! +${qSmug.rewardJade.toLocaleString()} MMK`,
                  );
                } else {
                  showBanner(
                    `မှောင်ခိုဂိုဏ်းသား ရှင်းလင်းမှု (${qSmug.progress}/${qSmug.goal})`,
                    `Smuggler Defeated! +${bountyMmk.toLocaleString()} MMK (${sim.comboCount}x Combo)`,
                  );
                }
              } else {
                showBanner(
                  `ရန်သူကို အနိုင်ယူပြီး! (+${bountyMmk.toLocaleString()} MMK)`,
                  `Dragon Nhtu Slash! ${sim.comboCount}x Combo`,
                );
              }
            }
          }
        }
      }
    };

    const toggleVehicleMount = () => {
      if (sim.phase !== 'playing') return;
      if (sim.isFishing) {
        stopFishingMode(true);
      }
      if (sim.activeVehicle) {
        const v = sim.activeVehicle;
        v.group.rotation.z = 0;
        sim.activeVehicle = null;
        sim.virtualThrottle = 0;
        sim.playerX = v.x - Math.cos(v.heading) * (v.type === 'ebike' ? 1.4 : 2.8);
        sim.playerZ = v.z + Math.sin(v.heading) * (v.type === 'ebike' ? 1.4 : 2.8);
        sim.playerY = playableSurfaceHeightAt(sim.playerX, sim.playerZ);
        hero.group.visible = true;
        hero.group.rotation.z = 0;
        showBanner('ခြေလျင် လျှောက်သွားမုဒ် (On-Foot Mode)', 'Smooth 360° Free-Move Active');
      } else {
        let closest: WorldVehicle | null = null;
        let minDist = 8.5;
        for (const v of vehicles) {
          const d = Math.hypot(v.x - sim.playerX, v.z - sim.playerZ);
          if (d < minDist) {
            minDist = d;
            closest = v;
          }
        }
        if (!closest) {
          // Summon the AIMA A5 Pro Electric Scooter (ဘက်ထရီဆိုင်ကယ်) right to the player if no vehicle is nearby!
          closest = vehicles[0];
          closest.x = sim.playerX;
          closest.z = sim.playerZ;
          closest.heading = sim.playerHeading;
        }
        sim.isManauDancing = false;
        hero.bladeMesh.visible = true;
        hero.leftFanMesh.visible = false;
        hero.rightFanMesh.visible = false;
        hero.fishingRodMesh.visible = false;
        sim.activeVehicle = closest;
        sim.playerX = closest.x;
        sim.playerZ = closest.z;
        sim.playerHeading = closest.heading;
        sim.cameraYawTarget = closest.heading;
        hero.group.visible = closest.type === 'ebike';
        soundEngine.playJump();
        if (closest.type === 'ebike' && soundEngine.getCurrentTrack() === 'off') {
          soundEngine.playMusicTrack(closest.id.includes('one') ? 'sample2' : 'sample1');
        }
        showBanner(
          `ယာဉ်မောင်းနှင်မှု: ${closest.label}`,
          closest.type === 'ebike'
            ? `🎵 ${soundEngine.getCurrentTrackLabel()} ဖွင့်ထားသည်`
            : 'Use Left Joystick (▲/▼/◀/▶) or Pedals',
        );
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      heldKeys[e.code] = true;

      if (e.code === 'Enter' || e.code === 'Space') {
        if (sim.phase === 'title') {
          e.preventDefault();
          sim.phase = 'playing';
          soundEngine.playManauGong();
          return;
        }
      }

      if (e.code === 'Escape') {
        if (sim.isFishing) {
          stopFishingMode();
          return;
        }
        if (sim.phase === 'playing') {
          sim.phase = 'paused';
          clearHeldInputs();
        } else if (sim.phase === 'paused') {
          sim.phase = 'playing';
        }
        return;
      }

      if (sim.phase !== 'playing') return;

      // When Fishing Mini-Game is active, Space or E hooks/reels in the fish!
      if (sim.isFishing) {
        if (e.code === 'Space' || e.code === 'KeyE') {
          e.preventDefault();
          sim.fishingReelHeld = true;
          if (!e.repeat) {
            handleFishingActionTap();
          }
          return;
        }
      }

      // When dancing in Sitapu Manau Park, WASD / Arrow Keys / 1-4 trigger Rhythm Dance moves!
      if (sim.isManauDancing && !e.repeat) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'Digit1') {
          e.preventDefault();
          handleManauRhythmPress('left');
          return;
        }
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Digit2') {
          e.preventDefault();
          handleManauRhythmPress('up');
          return;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Digit3') {
          e.preventDefault();
          handleManauRhythmPress('down');
          return;
        }
        if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'Digit4') {
          e.preventDefault();
          handleManauRhythmPress('right');
          return;
        }
      }

      if (e.code === 'Space') {
        sim.jumpBufferTimer = 0.16;
      } else if (e.code === 'KeyE') {
        triggerInteractOrAttack();
      } else if (e.code === 'KeyF') {
        toggleVehicleMount();
      } else if (e.code === 'KeyR') {
        sim.cameraYawTarget = sim.playerHeading;
      } else if (e.code === 'KeyM') {
        soundEngine.setMuted(!soundEngine.getMuted());
      } else if (e.code === 'KeyC') {
        const modes: CameraMode[] = ['chase', 'high', 'overhead', 'cinematic'];
        sim.cameraMode = modes[(modes.indexOf(sim.cameraMode) + 1) % modes.length];
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      heldKeys[e.code] = false;
      if (e.code === 'Space' || e.code === 'KeyE') {
        sim.fishingReelHeld = false;
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      // Ignore synthetic mouse events generated from mobile touch
      if ('pointerType' in e && (e as PointerEvent).pointerType === 'touch') return;
      if (e.clientX < window.innerWidth * 0.4 && e.clientY > window.innerHeight * 0.45) return;
      if (e.button === 0 && sim.phase === 'playing') {
        isPointerDragging = true;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      if (isPointerDragging && sim.phase === 'playing') {
        const dx = e.clientX - prevPointerX;
        const dy = e.clientY - prevPointerY;
        prevPointerX = e.clientX;
        prevPointerY = e.clientY;
        // Gentle, low-sensitivity camera rotation (never dizzying)
        const sens = playerSettings.cameraSensitivity;
        const ySign = playerSettings.invertCameraY ? -1 : 1;
        sim.cameraYawTarget -= dx * 0.0028 * sens;
        sim.cameraPitch = THREE.MathUtils.clamp(sim.cameraPitch + dy * 0.002 * sens * ySign, 0.16, 0.72);
        sim.manualLookCooldown = 1.6;
      }
    };

    const onPointerUp = () => {
      isPointerDragging = false;
    };

    // Touch swipe camera rotation ONLY in the center/upper-right open screen (never conflicts with left thumbstick)
    const onTouchStart = (e: TouchEvent) => {
      if (sim.phase !== 'playing' || activeLookTouchId !== null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        // Ignore touches in the left 42% (joystick area)
        if (t.clientX > window.innerWidth * 0.42) {
          activeLookTouchId = t.identifier;
          prevTouchX = t.clientX;
          prevTouchY = t.clientY;
          break;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (sim.phase !== 'playing' || activeLookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === activeLookTouchId) {
          const dx = t.clientX - prevTouchX;
          const dy = t.clientY - prevTouchY;
          prevTouchX = t.clientX;
          prevTouchY = t.clientY;
          // Gentle, smooth mobile camera look sensitivity
          const sens = playerSettings.cameraSensitivity;
          const ySign = playerSettings.invertCameraY ? -1 : 1;
          sim.cameraYawTarget -= dx * 0.0026 * sens;
          sim.cameraPitch = THREE.MathUtils.clamp(sim.cameraPitch + dy * 0.0018 * sens * ySign, 0.18, 0.68);
          sim.manualLookCooldown = 2.4;
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeLookTouchId) {
          activeLookTouchId = null;
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearHeldInputs);
    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    domElem.addEventListener('touchstart', onTouchStart, { passive: true });
    domElem.addEventListener('touchmove', onTouchMove, { passive: true });
    domElem.addEventListener('touchend', onTouchEnd, { passive: true });
    domElem.addEventListener('touchcancel', onTouchEnd, { passive: true });

    const applyAtmosphere = (tod: TimeOfDay, weather: WeatherMode) => {
      sim.timeOfDay = tod;
      sim.weather = weather;
      const p = TIME_PALETTES[tod];
      scene.background = new THREE.Color(p.skyHex);
      if (scene.fog instanceof THREE.FogExp2) {
        if (weather === 'mist') {
          scene.fog.color.setHex(0xcbd5e1);
          scene.fog.density = 0.0038;
        } else if (weather === 'rain') {
          scene.fog.color.setHex(0x475569);
          scene.fog.density = 0.0026;
        } else {
          scene.fog.color.setHex(p.fogHex);
          scene.fog.density = 0.00045;
        }
        scene.fog.density = Math.max(scene.fog.density, quality.minFogDensity);
      }
      sunLight.color.setHex(p.sunHex);
      sunLight.intensity = weather === 'rain' ? p.sunIntensity * 0.65 : p.sunIntensity;
      hemiLight.color.setHex(p.hemiSky);
      hemiLight.groundColor.setHex(p.hemiGround);
      hemiLight.intensity = p.hemiIntensity;
    };

    const startFoodDeliveryMission = () => {
      if (sim.isFishing) stopFishingMode(true);
      const firstStop = DELIVERY_STOPS[0];
      // Automatically mount the AIMA A5 Pro Electric Scooter & warp near Lung Ga Pa if far away!
      const ebike = vehicles[0];
      if (Math.hypot(sim.playerX - firstStop.x, sim.playerZ - firstStop.z) > 45) {
        sim.playerX = firstStop.x + 12;
        sim.playerZ = firstStop.z + 9;
        sim.playerY = playableSurfaceHeightAt(sim.playerX, sim.playerZ);
        _smoothLookAt.set(sim.playerX, sim.playerY + 1.8, sim.playerZ);
      }
      ebike.x = sim.playerX;
      ebike.z = sim.playerZ;
      ebike.heading = Math.atan2(firstStop.x - sim.playerX, firstStop.z - sim.playerZ);
      ebike.speed = 0;
      sim.activeVehicle = ebike;
      sim.playerHeading = ebike.heading;
      sim.cameraYaw = ebike.heading;
      sim.cameraYawTarget = ebike.heading;
      hero.group.visible = true;

      sim.activeChallenge = {
        type: 'delivery',
        titleMm: 'ကချင်ထမင်းဟင်း ပို့ဆောင်ရေး (AIMA Food Delivery)',
        stepLabelMm: firstStop.labelMm,
        currentStep: 0,
        totalSteps: DELIVERY_STOPS.length,
        timeRemainingSec: 180,
        targetX: firstStop.x,
        targetZ: firstStop.z,
      };
      sim.customWaypoint = {
        x: firstStop.x,
        z: firstStop.z,
        labelMm: firstStop.labelMm,
      };
      soundEngine.playManauGong();
      spawnBurst(sim.playerX, sim.playerY + 1.5, sim.playerZ, '#f59e0b', 14);
      showBanner(
        'မုန့်ပို့မစ်ရှင် စတင်ပြီ! (AIMA E-Bike Food Delivery)',
        firstStop.labelMm,
      );
    };

    const startStreetTimeTrialMission = () => {
      if (sim.isFishing) stopFishingMode(true);
      const firstGate = TIME_TRIAL_GATES[0];
      const ebike = vehicles[0];
      if (Math.hypot(sim.playerX - firstGate.x, sim.playerZ - firstGate.z) > 45) {
        sim.playerX = 0;
        sim.playerZ = 32;
        sim.playerY = playableSurfaceHeightAt(0, 32);
        _smoothLookAt.set(0, sim.playerY + 1.8, 32);
      }
      ebike.x = sim.playerX;
      ebike.z = sim.playerZ;
      ebike.heading = 0; // Facing South (+Z) directly into Gate 1 at (0, 42)
      ebike.speed = 0;
      sim.activeVehicle = ebike;
      sim.playerHeading = 0;
      sim.cameraYaw = 0;
      sim.cameraYawTarget = 0;
      hero.group.visible = true;

      sim.activeChallenge = {
        type: 'timetrial',
        titleMm: 'စီတာပူ မြစ်ကမ်းဘေး ပြိုင်ပွဲ (Sitapu Street Time Trial)',
        stepLabelMm: firstGate.labelMm,
        currentStep: 0,
        totalSteps: TIME_TRIAL_GATES.length,
        timeRemainingSec: 170,
        targetX: firstGate.x,
        targetZ: firstGate.z,
      };
      sim.customWaypoint = {
        x: firstGate.x,
        z: firstGate.z,
        labelMm: firstGate.labelMm,
      };
      soundEngine.playManauGong();
      spawnBurst(sim.playerX, sim.playerY + 1.5, sim.playerZ, '#10b981', 14);
      showBanner(
        'စီတာပူ ဆိုင်ကယ်/ကား ပြိုင်ပွဲ စတင်ပြီ!',
        firstGate.labelMm,
      );
    };


    // ======================================================================
    // 💾 SAVE / LOAD SYSTEM (localStorage auto-save)
    // ======================================================================
    const buildSaveData = (): GameSaveData => {
      // ယာဉ်စီးနေလျှင် ယာဉ်တည်နေရာကို သိမ်းသည်
      const px = sim.activeVehicle ? sim.activeVehicle.x : sim.playerX;
      const pz = sim.activeVehicle ? sim.activeVehicle.z : sim.playerZ;
      return {
        version: SAVE_VERSION,
        savedAt: Date.now(),
        moneyMmk: sim.jadeCount,
        score: sim.score,
        meritLevel: sim.meritLevel,
        health: sim.health,
        player: { x: px, z: pz, heading: sim.playerHeading },
        quests: sim.quests.map((q) => ({
          id: q.id,
          progress: q.progress,
          completed: q.completed,
        })),
        world: {
          drumsActivated: manauDrums.map((d) => d.activated),
          bridgeCheckpointsPassed: bridgeCheckpoints.map((cp) => cp.passed),
          enemiesAlive: enemies.map((e) => e.alive),
          peaceBellRung: peaceBell.rung,
          timeOfDay: sim.timeOfDay,
          weather: sim.weather,
        },
        fishing: {
          rodLevel: sim.fishingRodLevel,
          totalCaught: sim.fishingTotalCaught,
          totalSold: sim.fishingTotalSold,
          totalEarnedMmk: sim.fishingTotalEarnedMmk,
          biggestKg: sim.fishingBiggestKg,
          basket: sim.fishingBasket,
          caughtSpecies: sim.fishingCaughtSpecies,
        },
      };
    };

    let lastAutosaveMs = performance.now();
    const persistGame = (showToast = false) => {
      // ဂိမ်းမစရသေး / အနိုင်ရပြီး အခြေအနေတွင် မသိမ်းပါ
      if (sim.phase === 'title' || sim.phase === 'victory') return;
      lastAutosaveMs = performance.now();
      const ok = saveGame(buildSaveData());
      if (showToast) {
        showBanner(
          ok ? '💾 ဂိမ်းသိမ်းဆည်းပြီးပါပြီ' : '⚠️ ဂိမ်းသိမ်း၍ မရပါ',
          ok ? 'Progress Saved' : 'Browser storage ပိတ်ထားနိုင်သည် (Private mode?)',
        );
      }
    };

    const applySaveData = (data: GameSaveData) => {
      stopFishingMode(true);
      sim.activeVehicle = null;
      sim.activeChallenge = null;
      sim.isManauDancing = false;
      sim.customWaypoint = null;

      sim.jadeCount = Math.max(0, Math.floor(data.moneyMmk));
      sim.score = Math.max(0, Math.floor(data.score || 0));
      sim.meritLevel = Math.max(1, Math.floor(data.meritLevel || 1));
      sim.health = sim.maxHealth; // ဆက်ကစားလျှင် ကျန်းမာရေး အပြည့်ဖြင့် ပြန်စသည်
      sim.stamina = 100;

      // ရေထဲ (လှေစီးနေစဉ်) သိမ်းထားလျှင် မနောကွင်းဘေးသို့ ပြန်ပို့သည်
      let sx = data.player.x;
      let sz = data.player.z;
      if (waterSignedDistance(sx, sz) < 1 && !isBridgeDeck(sx, sz)) {
        sx = 0;
        sz = 36;
      }
      sim.playerX = sx;
      sim.playerZ = sz;
      sim.playerY = playableSurfaceHeightAt(sx, sz);
      sim.playerVx = 0;
      sim.playerVz = 0;
      sim.playerVy = 0;
      sim.playerHeading = data.player.heading ?? Math.PI;
      sim.cameraYaw = sim.playerHeading;
      sim.cameraYawTarget = sim.playerHeading;

      sim.quests = mergeQuestProgress(INITIAL_QUESTS, data.quests);

      manauDrums.forEach((d, i) => {
        d.activated = !!data.world.drumsActivated?.[i];
        const mat = d.ringMesh.material as THREE.MeshStandardMaterial;
        mat.color.set(d.activated ? '#10b981' : '#f59e0b');
        if (d.activated) mat.emissive.set('#059669');
      });
      bridgeCheckpoints.forEach((cp, i) => {
        cp.passed = !!data.world.bridgeCheckpointsPassed?.[i];
        cp.mesh.visible = !cp.passed;
      });
      enemies.forEach((e, i) => {
        const alive = data.world.enemiesAlive?.[i] ?? true;
        e.alive = alive;
        e.hp = alive ? e.maxHp : 0;
        e.x = e.homeX;
        e.z = e.homeZ;
        e.group.visible = alive;
      });
      peaceBell.rung = !!data.world.peaceBellRung;

      const f = data.fishing;
      sim.fishingRodLevel = (Math.max(0, Math.min(3, f.rodLevel | 0)) as FishingRodLevel);
      sim.fishingPhase = sim.fishingRodLevel === 0 ? 'no_gear' : 'ready';
      sim.fishingTotalCaught = f.totalCaught || 0;
      sim.fishingTotalSold = f.totalSold || 0;
      sim.fishingTotalEarnedMmk = f.totalEarnedMmk || 0;
      sim.fishingBiggestKg = f.biggestKg || 0;
      sim.fishingLastCatch = null;
      sim.fishingBasket = Array.isArray(f.basket) ? f.basket : [];
      sim.fishingCaughtSpecies = Array.isArray(f.caughtSpecies) ? f.caughtSpecies : [];
      sim.fishingMessageMm =
        sim.fishingRodLevel === 0
          ? '🛒 ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!'
          : `✅ ${FISHING_GEAR_TIERS[sim.fishingRodLevel].nameMm} အသင့်ရှိသည်!`;

      hero.group.visible = true;
      hero.bladeMesh.visible = true;
      hero.leftFanMesh.visible = false;
      hero.rightFanMesh.visible = false;
      hero.fishingRodMesh.visible = false;

      if (data.world.timeOfDay && data.world.weather) {
        applyAtmosphere(data.world.timeOfDay, data.world.weather);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistGame();
    };
    const onPageHide = () => persistGame();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    // Dev-only test hook (removed from production builds): window.__game.sim / .controller
    if (import.meta.env.DEV) {
      (window as unknown as { __game: unknown }).__game = {
        sim,
        get controller() {
          return controllerRef.current;
        },
      };
    }

    controllerRef.current = {
      startGame: () => {
        clearSave(); // ဂိမ်းအသစ် — save အဟောင်းကို ဖျက်သည်
        sim.phase = 'playing';
        soundEngine.playManauGong();
        persistGame();
      },
      continueGame: () => {
        const data = loadGame();
        if (data) {
          applySaveData(data);
          sim.phase = 'playing';
          soundEngine.playManauGong();
          const done = sim.quests.filter((q) => q.completed).length;
          showBanner(
            '💾 သိမ်းထားသော ဂိမ်းမှ ဆက်လက်ကစားနေသည်',
            `လက်ကျန်ငွေ ${sim.jadeCount.toLocaleString()} MMK · မစ်ရှင် ${done}/${sim.quests.length} ပြီးဆုံး`,
          );
        } else {
          sim.phase = 'playing';
          soundEngine.playManauGong();
        }
      },
      saveNow: () => persistGame(true),
      resumeGame: () => {
        sim.phase = 'playing';
      },
      pauseGame: () => {
        sim.phase = 'paused';
        clearHeldInputs();
        persistGame();
      },
      restartGame: () => {
        clearSave();
        stopFishingMode(true);
        sim.health = 100;
        sim.stamina = 100;
        sim.jadeCount = 50000; // Reset to 50,000 MMK starter capital
        sim.score = 0;
        sim.playerX = 0;
        sim.playerZ = 36;
        sim.playerY = playableSurfaceHeightAt(0, 36);
        sim.playerVx = 0;
        sim.playerVz = 0;
        sim.playerHeading = Math.PI;
        sim.cameraYaw = Math.PI;
        sim.cameraYawTarget = Math.PI;
        sim.activeVehicle = null;
        sim.activeChallenge = null;
        sim.isManauDancing = false;
        sim.rhythmStepIndex = 0;
        sim.rhythmBeatTimer = 0;
        sim.rhythmHitsCompleted = 0;
        sim.rhythmStreak = 0;
        sim.rhythmLastRating = null;
        sim.fishingRodLevel = 0;
        sim.fishingPhase = 'no_gear';
        sim.fishingTotalCaught = 0;
        sim.fishingTotalSold = 0;
        sim.fishingTotalEarnedMmk = 0;
        sim.fishingBiggestKg = 0;
        sim.fishingLastCatch = null;
        sim.fishingBasket = [];
        sim.fishingCaughtSpecies = [];
        sim.fishingMessageMm =
          '🛒 ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!';
        hero.group.visible = true;
        hero.bladeMesh.visible = true;
        hero.leftFanMesh.visible = false;
        hero.rightFanMesh.visible = false;
        hero.fishingRodMesh.visible = false;
        sim.quests = INITIAL_QUESTS.map((q) => ({ ...q }));
        manauDrums.forEach((d) => {
          d.activated = false;
          (d.ringMesh.material as THREE.MeshStandardMaterial).color.set('#f59e0b');
        });
        bridgeCheckpoints.forEach((cp) => {
          cp.passed = false;
          cp.mesh.visible = true;
        });
        enemies.forEach((e) => {
          e.alive = true;
          e.hp = e.maxHp;
          e.x = e.homeX;
          e.z = e.homeZ;
          e.group.visible = true;
        });
        peaceBell.rung = false;
        sim.phase = 'playing';
        soundEngine.playManauGong();
        persistGame();
      },
      teleportToRegion: (tx: number, tz: number, nameMm: string) => {
        stopFishingMode(true);
        sim.activeVehicle = null;
        hero.group.visible = true;
        sim.playerX = tx;
        sim.playerZ = tz;
        sim.playerY = playableSurfaceHeightAt(tx, tz);
        sim.playerVx = 0;
        sim.playerVz = 0;
        sim.playerVy = 0;
        sim.playerHeading = Math.PI;
        sim.cameraYaw = Math.PI;
        sim.cameraYawTarget = Math.PI;
        _smoothLookAt.set(tx, sim.playerY + 1.8, tz);
        soundEngine.playJadeCollect(3);
        showBanner(`နေရာရွှေ့ပြောင်းမှု: ${nameMm}`, 'Fast Traveled to Landmark');
      },
      summonVehicle: (type: 'ebike' | 'hilux4x4' | 'tuktuk' | 'riverboat') => {
        stopFishingMode(true);
        const targetVeh = vehicles.find((v) => v.type === type);
        if (!targetVeh) return;
        if (sim.activeVehicle) {
          sim.activeVehicle.group.rotation.z = 0;
        }
        if (type === 'riverboat') {
          const clampedZ = THREE.MathUtils.clamp(sim.playerZ, WORLD_BOUNDS.minZ + 40, WORLD_BOUNDS.maxZ - 40);
          targetVeh.x = riverCenterX(clampedZ) - 14;
          targetVeh.z = clampedZ;
        } else {
          targetVeh.x = sim.playerX;
          targetVeh.z = sim.playerZ;
        }
        sim.isManauDancing = false;
        hero.bladeMesh.visible = true;
        hero.leftFanMesh.visible = false;
        hero.rightFanMesh.visible = false;
        hero.fishingRodMesh.visible = false;
        targetVeh.heading = sim.playerHeading;
        targetVeh.speed = 0;
        sim.activeVehicle = targetVeh;
        sim.playerX = targetVeh.x;
        sim.playerZ = targetVeh.z;
        sim.cameraYawTarget = targetVeh.heading;
        hero.group.visible = type === 'ebike';
        hero.group.rotation.z = 0;
        soundEngine.playJump();
        if (type === 'ebike' && soundEngine.getCurrentTrack() === 'off') {
          soundEngine.playMusicTrack('sample1');
        }
        showBanner(
          `ယာဉ်ခေါ်ယူပြီး: ${targetVeh.label}`,
          type === 'ebike'
            ? `🎵 ${soundEngine.getCurrentTrackLabel()} ဖွင့်ထားသည်`
            : 'Use Left Joystick or Gas/Brake Pedals',
        );
      },
      startScenicRoute: (id: ScenicRouteId) => {
        const route = SCENIC_ROUTES[id];
        const ctl = controllerRef.current;
        if (!ctl) return;
        if (sim.isFishing) stopFishingMode(true);
        sim.activeChallenge = null;
        const first = route.stops[0];
        if (id === 'sunset_ride') {
          applyAtmosphere('sunset', 'clear');
          // Start a little before the first ring, on the e-bike
          ctl.teleportToRegion(first.x, first.z - 40, route.titleMm);
          ctl.summonVehicle('ebike');
          soundEngine.playMusicTrack('sample1');
        } else {
          applyAtmosphere('morning', 'mist');
          if (sim.activeVehicle) ctl.toggleEnterExitVehicle();
          ctl.teleportToRegion(0, 62, route.titleMm);
          soundEngine.playMusicTrack('off');
        }
        scenicRoute = { id, idx: 0 };
        showBanner(`🌅 ${route.titleMm}`, `${first.captionMm} — အချိန်ကန့်သတ်ချက် မရှိပါ၊ အေးအေးဆေးဆေး`);
      },
      stopScenicRoute: () => {
        scenicRoute = null;
        scenicRing.visible = false;
        sim.customWaypoint = null;
      },
      setTimeOfDay: (tod: TimeOfDay) => {
        applyAtmosphere(tod, sim.weather);
      },
      setWeather: (weather: WeatherMode) => {
        applyAtmosphere(sim.timeOfDay, weather);
        const label =
          weather === 'rain'
            ? 'မိုးရွာသီဥတု (ရေစိုလမ်းမ အလင်းပြန်စနစ်)'
            : weather === 'mist'
              ? 'မြစ်ကြီးနား ဆောင်းမြူနှင်း (Winter Mist)'
              : 'နေသာသော ရာသီဥတု (Clear Sky)';
        showBanner(`ရာသီဥတု ပြောင်းလဲပြီး: ${label}`, 'Dynamic Myitkyina Weather System');
      },
      startFoodDelivery: () => {
        startFoodDeliveryMission();
      },
      startStreetTimeTrial: () => {
        startStreetTimeTrialMission();
      },
      setCameraMode: (mode: CameraMode) => {
        sim.cameraMode = mode;
      },
      toggleMute: () => {
        soundEngine.setMuted(!soundEngine.getMuted());
      },
      triggerActionAttack: () => {
        triggerInteractOrAttack();
      },
      toggleEnterExitVehicle: () => {
        toggleVehicleMount();
      },
      setVirtualStick: (x: number, y: number, sprinting: boolean) => {
        sim.virtualStickX = x;
        sim.virtualStickY = y;
        sim.virtualSprint = sprinting;
      },
      setVirtualJumpBrake: (held: boolean) => {
        if (held && !sim.virtualJumpHeld) {
          sim.jumpBufferTimer = 0.16;
        }
        sim.virtualJumpHeld = held;
      },
      setVirtualThrottle: (throttle: number) => {
        sim.virtualThrottle = throttle;
      },
      resetCameraBehindPlayer: () => {
        sim.cameraYawTarget = sim.playerHeading;
      },
      setWaypoint: (x: number, z: number, labelMm: string) => {
        sim.customWaypoint = { x, z, labelMm };
        soundEngine.playJadeCollect(2);
        showBanner(`GPS လမ်းညွှန်မှတ်သားပြီး: ${labelMm}`, 'Follow Green 3D Arrow & Radar Route');
      },
      clearWaypoint: () => {
        sim.customWaypoint = null;
        showBanner('GPS လမ်းညွှန် မစ်ရှင်သို့ ပြန်ပြောင်းပြီး', 'GPS Reset to Active Quest');
      },
      warpToActiveQuest: () => {
        const activeQ = sim.quests.find((q) => !q.completed) || sim.quests[0];
        if (!activeQ) return;
        if (activeQ.id === 'quest_delivery') {
          startFoodDeliveryMission();
          return;
        }
        if (activeQ.id === 'quest_timetrial') {
          startStreetTimeTrialMission();
          return;
        }
        if (activeQ.id === 'quest_manau_rhythm') {
          sim.playerX = 0;
          sim.playerZ = 14;
          sim.playerY = playableSurfaceHeightAt(0, 14);
          _smoothLookAt.set(0, sim.playerY + 1.8, 14);
          setManauDanceState(true);
          return;
        }
        if (activeQ.id === 'quest_fishing') {
          startFishingAtSpot('spot_balaminhtin');
          return;
        }
        const tx = sim.customWaypoint ? sim.customWaypoint.x : activeQ.targetX;
        const tz = sim.customWaypoint ? sim.customWaypoint.z : activeQ.targetZ;
        const safePos = resolveBuildingCollision(tx, tz + 6, 1.5);
        sim.playerX = safePos.x;
        sim.playerZ = safePos.z;
        sim.playerY = playableSurfaceHeightAt(sim.playerX, sim.playerZ);
        if (sim.activeVehicle) {
          sim.activeVehicle.x = sim.playerX;
          sim.activeVehicle.z = sim.playerZ;
          sim.activeVehicle.speed = 0;
        }
        _smoothLookAt.set(sim.playerX, sim.playerY + 1.8, sim.playerZ);
        soundEngine.playJadeCollect(3);
        spawnBurst(sim.playerX, sim.playerY + 1.4, sim.playerZ, '#10b981', 14);
        showBanner(`မစ်ရှင်နေရာသို့ ရောက်ရှိပြီ: ${activeQ.titleMm}`, activeQ.descriptionMm);
      },
      upgradeHeroLevel: () => {
        const cost = 40000;
        if (sim.jadeCount < cost) {
          soundEngine.playDamageTaken();
          showBanner(
            `အဆင့်မြှင့်ရန် ငွေ (${cost.toLocaleString()} MMK) လိုအပ်ပါသည်!`,
            `လက်ရှိငွေ: ${sim.jadeCount.toLocaleString()} MMK — ငါးမျှား၍ ငါးဆိုင်တွင်ရောင်းခြင်း သို့မဟုတ် အလုပ်မစ်ရှင်များ လုပ်ဆောင်ပါ`,
          );
          return;
        }
        sim.jadeCount -= cost;
        sim.meritLevel += 1;
        sim.maxHealth += 25;
        sim.health = sim.maxHealth;
        sim.stamina = 100;
        sim.score += 400;
        soundEngine.playQuestComplete();
        triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, '#fbbf24');
        spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#fbbf24', 18);
        showBanner(
          `စွမ်းရည် အဆင့်မြှင့်တင်ပြီး! (Level ${sim.meritLevel})`,
          `ဓားခုတ်အား၊ ဆိုင်ကယ် Turbo နှုန်းနှင့် Max HP (${sim.maxHealth}) တိုးမြင့်သွားပါပြီ! (-${cost.toLocaleString()} MMK)`,
        );
      },
      toggleManauDance: () => {
        setManauDanceState(!sim.isManauDancing);
      },
      pressManauRhythmKey: (key: ManauBeatKey) => {
        handleManauRhythmPress(key);
      },
      startFishingAtSpot: (spotId?: string) => {
        startFishingAtSpot(spotId);
      },
      stopFishing: () => {
        stopFishingMode();
      },
      fishingActionTap: () => {
        handleFishingActionTap();
      },
      setFishingReelHeld: (held: boolean) => {
        sim.fishingReelHeld = held;
      },
      buyOrUpgradeFishingGear: () => {
        buyOrUpgradeFishingGear();
      },
      sellCaughtFish: () => {
        sellCaughtFish();
      },
      selectMusicTrack: (track: MusicTrackId) => {
        soundEngine.playMusicTrack(track);
        showBanner(
          track === 'off' ? '🔇 သီချင်း ပိတ်လိုက်ပါပြီ' : '🎵 ဘက်ထရီဆိုင်ကယ် သီချင်းဖွင့်စက်',
          soundEngine.getCurrentTrackLabel(),
        );
      },
      cycleMusicTrack: () => {
        const next = soundEngine.cycleMusicTrack();
        showBanner(
          next === 'off' ? '🔇 သီချင်း ပိတ်လိုက်ပါပြီ' : '🎵 သီချင်း ပြောင်းလဲဖွင့်လှစ်ပြီး',
          soundEngine.getCurrentTrackLabel(),
        );
      },
      uploadCustomSong: (file: File) => {
        soundEngine.loadCustomSongFile(file);
        showBanner(
          '🎵 ကိုယ်ပိုင်သီချင်း ထည့်သွင်းဖွင့်လှစ်ပြီး!',
          soundEngine.getCurrentTrackLabel(),
        );
      },
      toggleOsm3DLayer: () => {
        sim.osmVisible = !sim.osmVisible;
        osmContainerGroup.visible = sim.osmVisible;
        mini3DRoadsGroup.visible = !sim.osmVisible;
        downtownGroup.visible = !sim.osmVisible;
        showBanner(
          sim.osmVisible
            ? '🏙️ OpenStreetMap 3D မြို့ပြအလွှာ ဖွင့်ထားသည် (OSM 3D ON)'
            : '🏙️ OpenStreetMap 3D မြို့ပြအလွှာ ခေတ္တဖျောက်ထားသည် (OSM 3D OFF)',
          `3D အဆောက်အအုံ (${sim.osmBuildingsCount.toLocaleString()}) လုံးနှင့် 3D လမ်း (${sim.osmRoadsCount.toLocaleString()}) သွယ်`,
        );
      },
      toggleOsmDebugMode: () => {
        sim.osmDebugMode = !sim.osmDebugMode;
        osmDebugContainerGroup.children.forEach((c) => {
          c.visible = sim.osmDebugMode;
        });
        showBanner(
          sim.osmDebugMode
            ? '🔍 OSM 3D Debug Mode ဖွင့်ထားသည် (Bounding Box, Nearest Road & Building Count)'
            : '🔍 OSM 3D Debug Mode ပိတ်လိုက်ပါပြီ',
          `အနီးနား 150m အတွင်း OSM အဆောက်အအုံ: (${sim.osmNearbyBuildings150m}) လုံး · အနီးဆုံးလမ်း: ${sim.osmNearestRoadName} (${sim.osmNearestRoadDistM}m)`,
        );
      },
      teleportToOsmCity: (spawnIndex?: number) => {
        stopFishingMode(true);
        sim.activeNpcDialogue = null;
        sim.osmVisible = true;
        osmContainerGroup.visible = true;
        mini3DRoadsGroup.visible = false;
        downtownGroup.visible = false;

        const spawns =
          sim.osmCitySpawnPoints.length > 0 ? sim.osmCitySpawnPoints : DEFAULT_OSM_CITY_SPAWNS;
        const chosenIdx =
          typeof spawnIndex === 'number'
            ? spawnIndex % spawns.length
            : sim.osmCitySpawnIndex % spawns.length;
        sim.osmCitySpawnIndex = (chosenIdx + 1) % spawns.length;
        const target = spawns[chosenIdx];

        // Resolve collision-safe placement directly on the drivable OSM road!
        const safePos = resolveBuildingCollision(target.x, target.z, 2.0);
        sim.playerX = safePos.x;
        sim.playerZ = safePos.z;
        sim.playerY = playableSurfaceHeightAt(sim.playerX, sim.playerZ);
        sim.playerVx = 0;
        sim.playerVz = 0;
        sim.playerVy = 0;
        sim.playerHeading = target.heading;
        sim.cameraYaw = target.heading;
        sim.cameraYawTarget = target.heading;

        if (sim.activeVehicle) {
          sim.activeVehicle.x = sim.playerX;
          sim.activeVehicle.z = sim.playerZ;
          sim.activeVehicle.heading = target.heading;
          sim.activeVehicle.speed = 0;
          sim.activeVehicle.group.position.set(sim.playerX, sim.playerY, sim.playerZ);
          sim.activeVehicle.group.rotation.y = target.heading;
        } else {
          hero.group.visible = true;
          hero.group.position.set(sim.playerX, sim.playerY, sim.playerZ);
          hero.group.rotation.y = target.heading;
        }

        _smoothLookAt.set(sim.playerX, sim.playerY + 1.8, sim.playerZ);
        if (osmUpdateDebugFn) {
          const diag = osmUpdateDebugFn(sim.playerX, sim.playerY, sim.playerZ);
          sim.osmNearbyBuildings150m = diag.nearbyBuildings150m;
          sim.osmNearestRoadName = diag.nearestRoadName;
          sim.osmNearestRoadDistM = diag.nearestRoadDistM;
        }

        soundEngine.playQuestComplete();
        triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, '#38bdf8');
        spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#38bdf8', 18);
        showBanner(
          `🏙️ OSM မြို့လယ်လမ်းမပေါ်သို့ ရောက်ရှိပြီ: ${target.nameMm}`,
          `လမ်း: ${target.nameEn} · အနီးနား 150m အတွင်း OSM 3D အဆောက်အအုံ (${target.buildingsNearby}) လုံး`,
        );
      },
      toggleOverheadCamera: () => {
        sim.cameraMode = sim.cameraMode === 'overhead' ? 'chase' : 'overhead';
        showBanner(
          sim.cameraMode === 'overhead'
            ? '🛰️ အပေါ်စီးကင်မရာ (Overhead Camera Mode) — OSM လမ်းကွန်ရက်နှင့် အဆောက်အအုံများ စစ်ဆေးရန်'
            : '🎥 ပုံမှန် Third-Person Chase Camera သို့ ပြန်ပြောင်းပြီး',
          sim.cameraMode === 'overhead'
            ? `အနီးနား 150m ရှိ OSM အဆောက်အအုံ (${sim.osmNearbyBuildings150m}) လုံး · လမ်း (${sim.osmRoadsCount.toLocaleString()}) သွယ်`
            : 'Normal Chase Camera Active',
        );
      },
      uploadCustomOsmFile: async (file: File) => {
        try {
          const text = await file.text();
          const isXml = file.name.endsWith('.osm') || file.name.endsWith('.xml') || text.trim().startsWith('<');
          const geojson = isXml ? parseOsmXmlToGeoJson(text) : JSON.parse(text);
          loadOsmGeoJsonInto3D(geojson, file.name, true);
        } catch {
          showBanner(
            '❌ OpenStreetMap ဖိုင်ဖတ်ရာတွင် အမှားရှိနေပါသည်',
            '.geojson သို့မဟုတ် .osm ဖိုင်အမှန်ကို ရွေးချယ်ပေးပါ',
          );
        }
      },
      interactWithNpc: (npcId?: string) => {
        if (npcId) {
          const targetNpc = MYITKYINA_INTERACTIVE_NPCS.find((n) => n.id === npcId);
          if (targetNpc) {
            openNpcInteractionModal(targetNpc);
            return;
          }
        }
        // Otherwise find closest NPC
        let bestNpc = MYITKYINA_INTERACTIVE_NPCS[0];
        let bestDist = Infinity;
        for (const npc of MYITKYINA_INTERACTIVE_NPCS) {
          const d = Math.hypot(sim.playerX - npc.x, sim.playerZ - npc.z);
          if (d < bestDist) {
            bestDist = d;
            bestNpc = npc;
          }
        }
        openNpcInteractionModal(bestNpc);
      },
      closeNpcDialogue: () => {
        sim.activeNpcDialogue = null;
      },
      selectNpcDialogueOption: (optionId: string) => {
        if (!sim.activeNpcDialogue) return;
        const opt = sim.activeNpcDialogue.npc.dialogueOptions.find((o) => o.id === optionId);
        if (!opt) return;

        sim.activeNpcDialogue = {
          ...sim.activeNpcDialogue,
          currentReplyMm: opt.responseMm,
        };
        soundEngine.playJadeCollect(2);

        if (opt.actionType === 'claim_reward' && opt.rewardMmk) {
          if (!sim.npcClaimedBonusIds.includes(opt.id)) {
            sim.npcClaimedBonusIds.push(opt.id);
            sim.jadeCount += opt.rewardMmk;
            sim.score += 120;
            soundEngine.playQuestComplete();
            showBanner(
              `🎁 ${sim.activeNpcDialogue.npc.nameMm} မှ လက်ဆောင် +${opt.rewardMmk.toLocaleString()} MMK ချီးမြှင့်သည်!`,
              opt.responseMm,
            );
          } else {
            showBanner(
              `💬 ${sim.activeNpcDialogue.npc.nameMm}`,
              'ဤလက်ဆောင်ဆုကြေးကို ရယူပြီးဖြစ်ပါသည်!',
            );
          }
        } else if (
          opt.actionType === 'set_gps' &&
          typeof opt.targetX === 'number' &&
          typeof opt.targetZ === 'number'
        ) {
          sim.customWaypoint = {
            x: opt.targetX,
            z: opt.targetZ,
            labelMm: opt.targetLabelMm || sim.activeNpcDialogue.npc.nameMm,
          };
          showBanner(
            `📍 GPS လမ်းညွှန် မှတ်သားပြီး: ${opt.targetLabelMm || ''}`,
            'အစိမ်းရောင် 3D မြှားအတိုင်း သွားရောက်နိုင်ပါပြီ!',
          );
        } else if (opt.actionType === 'close') {
          sim.activeNpcDialogue = null;
        }
      },
      buyOrSellNpcItem: (itemId: string) => {
        if (!sim.activeNpcDialogue || !sim.activeNpcDialogue.npc.tradeItems) return;
        const item = sim.activeNpcDialogue.npc.tradeItems.find((t) => t.id === itemId);
        if (!item) return;

        if (item.effectType === 'sell_all_fish') {
          sellCaughtFish();
          return;
        }
        if (sim.jadeCount < item.priceMmk) {
          soundEngine.playDamageTaken();
          showBanner(
            `❌ ငွေမလုံလောက်ပါ! လိုအပ်ငွေ: ${item.priceMmk.toLocaleString()} MMK`,
            `လက်ရှိငွေ: ${sim.jadeCount.toLocaleString()} MMK`,
          );
          return;
        }

        sim.jadeCount -= item.priceMmk;
        soundEngine.playJadeCollect(4);
        spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#fbbf24', 16);

        if (item.effectType === 'heal_full') {
          sim.health = sim.maxHealth;
          sim.stamina = 100;
        } else if (item.effectType === 'stamina_boost') {
          sim.maxHealth += 15;
          sim.health = sim.maxHealth;
          sim.stamina = 100;
        } else if (item.effectType === 'max_hp_boost') {
          sim.meritLevel += 1;
          sim.maxHealth += 25;
          sim.health = sim.maxHealth;
          sim.score += 350;
        }

        sim.activeNpcDialogue = {
          ...sim.activeNpcDialogue,
          currentReplyMm: `✅ "${item.nameMm}" ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်! (${item.descriptionMm})`,
        };
        showBanner(
          `🛒 ဝယ်ယူပြီး: ${item.nameMm} (-${item.priceMmk.toLocaleString()} MMK)`,
          item.descriptionMm,
        );
      },
    };

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let isDisposed = false;
    let fpsFrames = 0;
    let fpsWindowStart = performance.now();
    const clock = new THREE.Clock();
    let lastHudEmit = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();

      updateWater(elapsed);
      updateTrafficLights(elapsed);
      updateWeather(
        elapsed,
        dt,
        sim.playerX,
        sim.playerY,
        sim.playerZ,
        sim.timeOfDay,
        sim.weather,
      );
      updateTraffic(dt, sim.playerX, sim.playerZ);
      updateNPCs(elapsed, dt);
      updateArcadeItems(elapsed, dt);
      if (osmUpdateDebugFn) {
        const diag = osmUpdateDebugFn(sim.playerX, sim.playerY, sim.playerZ);
        sim.osmNearbyBuildings150m = diag.nearbyBuildings150m;
        sim.osmNearestRoadName = diag.nearestRoadName;
        sim.osmNearestRoadDistM = diag.nearestRoadDistM;
      }
      updateFishingWorld(elapsed, {
        visible:
          sim.isFishing &&
          sim.fishingRodLevel > 0 &&
          (sim.fishingPhase === 'waiting' ||
            sim.fishingPhase === 'bite' ||
            sim.fishingPhase === 'reeling'),
        x: sim.activeFishingSpot.waterX,
        z: sim.activeFishingSpot.waterZ,
        biting: sim.fishingPhase === 'bite' || sim.fishingPhase === 'reeling',
      });

      for (const drum of manauDrums) {
        drum.ringMesh.rotation.z = elapsed * 1.2;
      }

      if (sim.phase === 'title') {
        const panAngle = elapsed * 0.12;
        const focusX = Math.sin(panAngle * 0.7) * 32;
        const focusZ = Math.cos(panAngle * 0.5) * 32;
        camera.position.set(
          focusX + Math.cos(panAngle) * 65,
          24 + Math.sin(elapsed * 0.3) * 3,
          focusZ + Math.sin(panAngle) * 65,
        );
        camera.lookAt(focusX, 5, focusZ);
      } else if (sim.phase === 'playing') {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer -= dt;
        } else {
          if (sim.attackCooldown > 0) sim.attackCooldown -= dt;
          if (sim.manualLookCooldown > 0) sim.manualLookCooldown = Math.max(0, sim.manualLookCooldown - dt);

          if (sim.slashAnimTimer > 0) {
            sim.slashAnimTimer -= dt;
            (hero.swordSlashMesh.material as THREE.MeshBasicMaterial).opacity =
              (sim.slashAnimTimer / 0.22) * 0.85;
            hero.swordSlashMesh.rotation.y = (1 - sim.slashAnimTimer / 0.22) * Math.PI;
          } else {
            (hero.swordSlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
          }

          if (sim.comboTimer > 0) {
            sim.comboTimer -= dt;
            if (sim.comboTimer <= 0) sim.comboCount = 0;
          }

          // Combine Keyboard WASD + Mobile Virtual Thumbstick with Ultra-Smooth Analog Damping
          const kbForward =
            (heldKeys['KeyW'] || heldKeys['ArrowUp'] ? 1 : 0) -
            (heldKeys['KeyS'] || heldKeys['ArrowDown'] ? 1 : 0);
          const kbRight =
            (heldKeys['KeyD'] || heldKeys['ArrowRight'] ? 1 : 0) -
            (heldKeys['KeyA'] || heldKeys['ArrowLeft'] ? 1 : 0);

          const targetForward = THREE.MathUtils.clamp(kbForward + sim.virtualStickY, -1, 1);
          const targetRight = THREE.MathUtils.clamp(kbRight + sim.virtualStickX, -1, 1);

          // Fast, jitter-free analog smoothing (eliminates mobile touch sampling stutter)
          sim.smoothForward = THREE.MathUtils.damp(sim.smoothForward, targetForward, 24, dt);
          sim.smoothRight = THREE.MathUtils.damp(sim.smoothRight, targetRight, 24, dt);
          if (Math.abs(targetForward) < 0.01 && Math.abs(sim.smoothForward) < 0.02) {
            sim.smoothForward = 0;
          }
          if (Math.abs(targetRight) < 0.01 && Math.abs(sim.smoothRight) < 0.02) {
            sim.smoothRight = 0;
          }

          const rawForward = sim.smoothForward;
          const rawRight = sim.smoothRight;
          const isSprinting = Boolean(
            heldKeys['ShiftLeft'] || heldKeys['ShiftRight'] || sim.virtualSprint,
          );
          const isBrakeHeld = Boolean(heldKeys['Space'] || sim.virtualJumpHeld);

          if (sim.activeVehicle) {
            // =========================================================================
            // GTA-STYLE VEHICLE DRIVING PHYSICS & STEADY FORWARD/REVERSE CHASE CAMERA
            // =========================================================================
            const v = sim.activeVehicle;
            const maxSpeed =
              v.type === 'hilux4x4'
                ? 34
                : v.type === 'ebike'
                  ? 29
                  : v.type === 'tuktuk'
                    ? 26
                    : 25;

            const throttleInput =
              Math.abs(sim.virtualThrottle) > 0.05 ? sim.virtualThrottle : rawForward;
            const steerInput = -rawRight;

            // Smooth, responsive forward & reverse acceleration (instant electric torque on ebike!)
            const accelRate = v.type === 'ebike' ? 35 : 30;
            const accel = throttleInput * accelRate;
            v.speed += accel * dt;

            // Natural coasting drag when no throttle is applied
            if (Math.abs(throttleInput) < 0.08) {
              v.speed *= Math.exp(-3.2 * dt);
              if (Math.abs(v.speed) < 0.15) v.speed = 0;
            } else {
              v.speed *= Math.exp(-1.4 * dt);
            }

            if (isBrakeHeld) {
              v.speed *= Math.exp(-8.0 * dt);
            }
            v.speed = THREE.MathUtils.clamp(v.speed, -18, maxSpeed);

            if (Math.abs(v.speed) > 0.3) {
              const turnDir = v.speed >= 0 ? 1 : -1;
              const speedFactor = Math.min(1, Math.abs(v.speed) / 6);
              const turnAgility = v.type === 'ebike' ? 2.05 : 1.55;
              v.heading += steerInput * turnAgility * speedFactor * turnDir * dt;
            }

            const nextX = v.x + Math.sin(v.heading) * v.speed * dt;
            const nextZ = v.z + Math.cos(v.heading) * v.speed * dt;

            if (v.type === 'riverboat') {
              if (waterSignedDistance(nextX, nextZ) < 2.5) {
                v.x = nextX;
                v.z = nextZ;
              } else {
                v.speed *= -0.35;
              }
              v.group.position.set(v.x, -0.25 + Math.sin(elapsed * 3.5) * 0.06, v.z);
            } else {
              const inDeepWater =
                waterSignedDistance(nextX, nextZ) < -3.5 && !isBridgeDeck(nextX, nextZ);
              if (!inDeepWater) {
                const col = resolveBuildingCollision(
                  THREE.MathUtils.clamp(nextX, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX),
                  THREE.MathUtils.clamp(nextZ, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ),
                  v.type === 'ebike' ? 1.1 : 1.9,
                );
                v.x = col.x;
                v.z = col.z;
                if (col.hit) {
                  v.speed *= 0.25;
                }
              } else {
                v.speed *= -0.4;
              }
              const surfaceY = playableSurfaceHeightAt(v.x, v.z);
              v.group.position.set(v.x, surfaceY, v.z);
              v.wheels.forEach((w) => {
                w.rotation.x += v.speed * dt * (v.type === 'ebike' ? 2.4 : 1.6);
              });
            }

            v.group.rotation.y = v.heading;

            // If riding the AIMA Electric Scooter (ဘက်ထရီဆိုင်ကယ်), lean into turns & position rider on the seat!
            if (v.type === 'ebike') {
              const targetLean = -steerInput * Math.min(1, Math.abs(v.speed) / 9) * 0.2;
              v.group.rotation.z = THREE.MathUtils.damp(v.group.rotation.z, targetLean, 12, dt);

              hero.group.visible = true;
              const seatBackX = v.x - Math.sin(v.heading) * 0.28;
              const seatBackZ = v.z - Math.cos(v.heading) * 0.28;
              hero.group.position.set(seatBackX, v.group.position.y + 0.36, seatBackZ);
              hero.group.rotation.y = v.heading;
              hero.group.rotation.z = v.group.rotation.z;
              hero.leftArm.rotation.x = -0.95;
              hero.rightArm.rotation.x = -0.95;
              hero.leftLeg.rotation.x = -0.55;
              hero.rightLeg.rotation.x = -0.55;
            } else {
              v.group.rotation.z = 0;
              hero.group.visible = false;
            }

            sim.playerX = v.x;
            sim.playerZ = v.z;
            sim.playerY = v.group.position.y;
            sim.playerHeading = v.heading;

            // Keep camera smoothly behind the vehicle (never flip 180 deg when reversing!)
            if (sim.manualLookCooldown <= 0 && Math.abs(v.speed) > 0.8) {
              const yawDiff = shortestAngleDiff(sim.cameraYawTarget, v.heading);
              sim.cameraYawTarget += yawDiff * (1 - Math.exp(-3.8 * dt));
            }

            if (Math.abs(v.speed) > 1.5) {
              soundEngine.playStepOrEngine(
                true,
                Math.abs(v.speed) / maxSpeed,
                v.type === 'ebike',
              );
            }
          } else {
            // =========================================================================
            // BUTTER-SMOOTH 360° CAMERA-RELATIVE MOBILE JOYSTICK MOVEMENT
            // + TRADITIONAL KACHIN MANAU FESTIVAL RHYTHM DANCE SEQUENCER
            // + AYEYARWADY & UNDER BALAMINHTIN BRIDGE FISHING MINI-GAME
            // =========================================================================
            const inputMag = Math.min(1, Math.hypot(rawForward, rawRight));
            const stickMag = Math.hypot(sim.virtualStickX, sim.virtualStickY);
            if (sim.isManauDancing && stickMag > 0.65) {
              // Pushing the mobile virtual joystick strongly exits Manau Dance Mode
              setManauDanceState(false);
            }
            if (sim.isFishing && stickMag > 0.72) {
              stopFishingMode();
            }

            if (sim.isFishing) {
              // Position Hero on the Pier holding the Bamboo Fishing Rod toward the Ayeyarwady River
              const pierY = playableSurfaceHeightAt(sim.activeFishingSpot.x, sim.activeFishingSpot.z) + 0.36;
              sim.playerX = sim.activeFishingSpot.x + 2.2;
              sim.playerZ = sim.activeFishingSpot.z;
              sim.playerY = pierY;
              sim.playerHeading = Math.PI / 2;

              const rodPull =
                sim.fishingPhase === 'reeling'
                  ? -0.95 + Math.sin(elapsed * 16) * 0.24
                  : sim.fishingPhase === 'bite'
                    ? -0.65 + Math.sin(elapsed * 22) * 0.16
                    : -0.45 + Math.sin(elapsed * 2.4) * 0.05;
              hero.rightArm.rotation.x = rodPull;
              hero.rightArm.rotation.z = -0.15;
              hero.leftArm.rotation.x = -0.35;
              hero.leftLeg.rotation.x = 0;
              hero.rightLeg.rotation.x = 0;
              hero.group.position.set(sim.playerX, sim.playerY, sim.playerZ);
              hero.group.rotation.y = sim.playerHeading;

              if (sim.fishingPhase === 'no_gear') {
                hero.fishingRodMesh.visible = false;
              } else if (sim.fishingPhase === 'waiting') {
                sim.fishingTimer -= dt;
                if (sim.fishingTimer <= 0) {
                  sim.fishingPhase = 'bite';
                  sim.fishingTimer = 2.6;
                  soundEngine.playFishBiteAlert();
                  sim.fishingMessageMm =
                    '⚡ ငါးဟပ်နေပြီ! အခုချက်ချင်း [🐟 ငါးဆွဲတင်မည်!] ခလုတ်ကို နှိပ်ပါ!';
                  spawnBurst(
                    sim.activeFishingSpot.waterX,
                    0.25,
                    sim.activeFishingSpot.waterZ,
                    '#fbbf24',
                    14,
                  );
                }
              } else if (sim.fishingPhase === 'bite') {
                sim.fishingTimer -= dt;
                if (sim.fishingTimer <= 0) {
                  // Fish nibbled and swam away -> auto re-cast so player never gets frustrated
                  sim.fishingPhase = 'waiting';
                  sim.fishingTimer = 1.4 + Math.random() * 1.4;
                  sim.fishingMessageMm =
                    '🌊 ငါးလွတ်သွားသည် — ငါးမျှားတံ ပြန်ချထားသည်၊ ဖော့တုံးလှုပ်လျှင် နှိပ်ပါ!';
                }
              } else if (sim.fishingPhase === 'reeling') {
                const currentGear =
                  FISHING_GEAR_TIERS[sim.fishingRodLevel] || FISHING_GEAR_TIERS[1];

                // Fish swims back and forth along the 0..100 tension gauge
                sim.fishingFishTargetTimer -= dt;
                if (sim.fishingFishTargetTimer <= 0) {
                  sim.fishingFishTargetTimer = 0.55 + Math.random() * 0.65;
                  sim.fishingFishTarget = 16 + Math.random() * 68;
                }
                const fishDiff = sim.fishingFishTarget - sim.fishingFishPos;
                // Higher gear level slightly calms wild fish movement
                const speedDamp = sim.fishingRodLevel === 3 ? 0.82 : sim.fishingRodLevel === 2 ? 0.9 : 1.0;
                sim.fishingFishPos +=
                  Math.sign(fishDiff) *
                  Math.min(Math.abs(fishDiff), sim.fishingCurrentSpec.speed * speedDamp * dt);

                // Player controls the Green Catch Bar by holding or releasing the Reel button
                const isReelInput =
                  sim.fishingReelHeld ||
                  heldKeys['Space'] ||
                  heldKeys['KeyE'] ||
                  sim.virtualJumpHeld;
                if (isReelInput) {
                  sim.fishingBarPos = Math.min(86, sim.fishingBarPos + 74 * dt);
                } else {
                  sim.fishingBarPos = Math.max(14, sim.fishingBarPos - 56 * dt);
                }

                // Check if the Fish is inside the Green Catch Window (barHalfWidth scales with Rod Level!)
                const inCatchZone =
                  Math.abs(sim.fishingFishPos - sim.fishingBarPos) <= currentGear.barHalfWidth;
                if (inCatchZone) {
                  sim.fishingReelProgress = Math.min(
                    100,
                    sim.fishingReelProgress + currentGear.reelRate * dt,
                  );
                } else {
                  // Budget Lv.1 rod loses line tension faster when outside the green zone!
                  const drainRate = sim.fishingRodLevel === 1 ? 17 : 12;
                  sim.fishingReelProgress = Math.max(5, sim.fishingReelProgress - drainRate * dt);
                }

                if (sim.fishingReelProgress >= 100) {
                  // Caught the Fish! Put it in the Fish Basket to sell at the Fish Shop for MMK!
                  const spec = sim.fishingCurrentSpec;
                  const weightScale = 0.8 + sim.fishingRodLevel * 0.15;
                  const rawWeight =
                    (spec.minKg + Math.random() * (spec.maxKg - spec.minKg)) * weightScale;
                  const weightKg = Number(rawWeight.toFixed(1));

                  // Calculate Fish Shop market value in MMK (rounded to nearest 500 MMK)
                  const rawMmk =
                    spec.basePriceMmk *
                    currentGear.valueMultiplier *
                    sim.activeFishingSpot.bonusMultiplier *
                    (0.85 + (weightKg / spec.maxKg) * 0.35);
                  const priceMmk = Math.round(rawMmk / 500) * 500;

                  const catchInfo: FishCatchInfo = {
                    id: `${spec.id}_${Date.now()}`,
                    nameMm: spec.nameMm,
                    nameEn: spec.nameEn,
                    weightKg,
                    rarity: spec.rarity,
                    priceMmk,
                    icon: spec.icon,
                  };

                  sim.fishingPhase = 'caught';
                  sim.fishingLastCatch = catchInfo;
                  sim.fishingBasket = [...sim.fishingBasket, catchInfo];
                  sim.fishingTotalCaught += 1;
                  if (weightKg > sim.fishingBiggestKg) {
                    sim.fishingBiggestKg = weightKg;
                  }
                  if (!sim.fishingCaughtSpecies.includes(spec.nameMm)) {
                    sim.fishingCaughtSpecies = [...sim.fishingCaughtSpecies, spec.nameMm];
                  }

                  let rareQuestJustCompleted = false;
                  const qRare = sim.quests.find((q) => q.id === 'quest_rare_fish');
                  if (qRare && !qRare.completed && spec.rarity !== 'common') {
                    qRare.progress = Math.min(qRare.goal, qRare.progress + 1);
                    if (qRare.progress >= qRare.goal) {
                      qRare.completed = true;
                      sim.jadeCount += qRare.rewardJade;
                      sim.score += 900;
                      soundEngine.playQuestComplete();
                      showBanner(
                        `🏆 ရှားပါးငါး မစ်ရှင် အောင်မြင်ပြီ! +${qRare.rewardJade.toLocaleString()} MMK`,
                        `${spec.icon} ${spec.nameMm} — ဧရာဝတီ ငါးဖမ်းဆရာကြီး ဖြစ်လာပါပြီ!`,
                      );
                      rareQuestJustCompleted = true;
                    }
                  }

                  sim.score += 180;
                  sim.health = Math.min(sim.maxHealth, sim.health + 10);
                  sim.stamina = 100;
                  sim.comboCount += 1;
                  sim.comboTimer = 5.0;

                  soundEngine.playSplash(true);
                  soundEngine.playJadeCollect(sim.comboCount);
                  triggerShockwave(sim.playerX, sim.playerY, sim.playerZ, '#38bdf8');
                  spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, '#38bdf8', 20);

                  const basketTotalMmk = sim.fishingBasket.reduce((s, f) => s + f.priceMmk, 0);
                  sim.fishingMessageMm = `🎉 ${spec.icon} ${spec.nameMm} (${weightKg} kg · တန်ဖိုး ${priceMmk.toLocaleString()} MMK) ဖမ်းမိပြီ! ငါးဆိုင်သို့ ရောင်းချပါ!`;

                  if (!rareQuestJustCompleted) showBanner(
                    `🐟 ${spec.nameMm} (${weightKg} kg) ငါးပလိုင်းထဲ ထည့်ပြီး!`,
                    `ခန့်မှန်းတန်ဖိုး: ${priceMmk.toLocaleString()} MMK · ပလိုင်းစုစုပေါင်း (${sim.fishingBasket.length}) ကောင် = ${basketTotalMmk.toLocaleString()} MMK (ငါးဆိုင်တွင် ရောင်းပါ!)`,
                  );
                }
              }
            } else if (sim.isManauDancing) {
              // Advance Manau Rhythm Beat Timer in sync with Traditional Kachin Manau Music
              sim.rhythmBeatTimer += dt;
              const currentBeatKey =
                MANAU_DANCE_PATTERN[sim.rhythmStepIndex % MANAU_DANCE_PATTERN.length];
              const beatProg = sim.rhythmBeatTimer / sim.rhythmBeatDuration;

              if (!sim.rhythmCuePlayed && beatProg >= 0.55) {
                sim.rhythmCuePlayed = true;
                soundEngine.playManauBeatCue(currentBeatKey);
              }

              if (sim.rhythmBeatTimer >= sim.rhythmBeatDuration) {
                // Player missed the beat window -> advance to next beat in sequence
                sim.rhythmBeatTimer = 0;
                sim.rhythmCuePlayed = false;
                sim.rhythmLastRating = 'MISS';
                sim.rhythmStreak = 0;
                sim.rhythmStepIndex += 1;
                const nextKey =
                  MANAU_DANCE_PATTERN[sim.rhythmStepIndex % MANAU_DANCE_PATTERN.length];
                sim.rhythmLastRatingTextMm = `⏱ စည်းချက်ကျော်သွားသည် — နောက်တစ်ချက်: ${MANAU_BEAT_LABELS_MM[nextKey]} အချိန်မီနှိပ်ပါ!`;
              }

              // Authentic Kachin Manau Circle Dance Choreography + 4 Rhythm Move Poses!
              const danceAngle = elapsed * 0.42;
              const danceRadius = 9.5 + Math.sin(elapsed * 1.5) * 0.6;
              sim.playerX = Math.cos(danceAngle) * danceRadius;
              sim.playerZ = 7.0 + Math.sin(danceAngle) * danceRadius * 0.75;
              const floorY = playableSurfaceHeightAt(sim.playerX, sim.playerZ);

              let extraJump = 0;
              if (sim.rhythmPoseTimer > 0) {
                sim.rhythmPoseTimer = Math.max(0, sim.rhythmPoseTimer - dt);
                if (sim.rhythmPoseKey === 'up') {
                  extraJump = Math.sin((sim.rhythmPoseTimer / 0.52) * Math.PI) * 0.85;
                }
              }

              const bounce = Math.abs(Math.sin(elapsed * 4.4)) * 0.16 + extraJump;
              sim.playerY = floorY + bounce;
              sim.playerHeading = -danceAngle;

              const wave = Math.sin(elapsed * 4.4);
              if (sim.rhythmPoseTimer > 0 && sim.rhythmPoseKey) {
                // Expressive 3D Pose for Left Fan / Right Fan / Hornbill Lift / Drum Step!
                if (sim.rhythmPoseKey === 'left') {
                  hero.leftArm.rotation.z = 1.65;
                  hero.leftArm.rotation.x = -1.1;
                  hero.rightArm.rotation.z = -0.45;
                  hero.rightArm.rotation.x = -0.25;
                } else if (sim.rhythmPoseKey === 'right') {
                  hero.leftArm.rotation.z = 0.45;
                  hero.leftArm.rotation.x = -0.25;
                  hero.rightArm.rotation.z = -1.65;
                  hero.rightArm.rotation.x = -1.1;
                } else if (sim.rhythmPoseKey === 'up') {
                  hero.leftArm.rotation.z = 1.45;
                  hero.leftArm.rotation.x = -1.35;
                  hero.rightArm.rotation.z = -1.45;
                  hero.rightArm.rotation.x = -1.35;
                } else {
                  hero.leftArm.rotation.z = 0.75;
                  hero.leftArm.rotation.x = 0.35;
                  hero.rightArm.rotation.z = -0.75;
                  hero.rightArm.rotation.x = 0.35;
                }
              } else {
                hero.leftArm.rotation.z = 0.92 + wave * 0.45;
                hero.leftArm.rotation.x = -0.55 + Math.cos(elapsed * 4.4) * 0.28;
                hero.rightArm.rotation.z = -0.92 - wave * 0.45;
                hero.rightArm.rotation.x = -0.55 - Math.cos(elapsed * 4.4) * 0.28;
              }
              hero.leftLeg.rotation.x = wave * 0.35;
              hero.rightLeg.rotation.x = -wave * 0.35;

              sim.squashY = THREE.MathUtils.damp(sim.squashY, 1.0, 12, dt);
              hero.bodyGroup.scale.set(
                1 / Math.sqrt(sim.squashY),
                sim.squashY,
                1 / Math.sqrt(sim.squashY),
              );
              hero.group.position.set(sim.playerX, sim.playerY, sim.playerZ);
              hero.group.rotation.y = sim.playerHeading;
            } else {
            const maxSpeed = isSprinting && sim.stamina > 5 ? 15.0 : 10.5;

            if (isSprinting && inputMag > 0.15) {
              sim.stamina = Math.max(0, sim.stamina - 14 * dt);
            } else {
              sim.stamina = Math.min(100, sim.stamina + 25 * dt);
            }

            if (inputMag > 0.03) {
              // Camera-relative unit basis vectors:
              // Forward (into screen) = (sin(cameraYaw), cos(cameraYaw))
              // Right (screen right)  = (-cos(cameraYaw), sin(cameraYaw))
              const camSin = Math.sin(sim.cameraYaw);
              const camCos = Math.cos(sim.cameraYaw);

              const moveDirX = camSin * rawForward - camCos * rawRight;
              const moveDirZ = camCos * rawForward + camSin * rawRight;
              const moveLen = Math.hypot(moveDirX, moveDirZ) || 1;
              const normDirX = moveDirX / moveLen;
              const normDirZ = moveDirZ / moveLen;

              // Continuous, linear-damped velocity in the exact direction of the joystick
              const walkSpeed = maxSpeed * inputMag;
              const targetVx = normDirX * walkSpeed;
              const targetVz = normDirZ * walkSpeed;
              sim.playerVx = THREE.MathUtils.damp(sim.playerVx, targetVx, 16, dt);
              sim.playerVz = THREE.MathUtils.damp(sim.playerVz, targetVz, 16, dt);

              // Smoothly rotate character body to face their movement direction
              const targetHeading = Math.atan2(normDirX, normDirZ);
              const headingDiff = shortestAngleDiff(sim.playerHeading, targetHeading);
              sim.playerHeading += headingDiff * (1 - Math.exp(-15 * dt));

              // Gentle auto-follow camera ONLY when steering left/right while moving forward/sideways.
              // When pulling backward (rawForward < -0.1), camera stays 100% steady so forward/back never fights the thumb!
              if (sim.manualLookCooldown <= 0 && rawForward >= -0.1 && Math.abs(rawRight) > 0.08) {
                const gentleTurnRate = 0.88;
                sim.cameraYawTarget -= rawRight * gentleTurnRate * inputMag * dt;
              }

              // Articulated limb swing animation proportional to speed
              const swingSpeed = isSprinting ? 14.5 : 10.0;
              const swing = Math.sin(elapsed * swingSpeed) * 0.55 * inputMag;
              hero.leftLeg.rotation.x = swing;
              hero.rightLeg.rotation.x = -swing;
              hero.leftArm.rotation.x = -swing * 0.82;
              hero.rightArm.rotation.x = swing * 0.82;

              if (sim.isGrounded) {
                soundEngine.playStepOrEngine(false, isSprinting ? 1 : 0.5);
              }
            } else {
              // Smooth, responsive stop when releasing the joystick
              sim.playerVx = THREE.MathUtils.damp(sim.playerVx, 0, 18, dt);
              sim.playerVz = THREE.MathUtils.damp(sim.playerVz, 0, 18, dt);

              hero.leftLeg.rotation.x = THREE.MathUtils.damp(hero.leftLeg.rotation.x, 0, 12, dt);
              hero.rightLeg.rotation.x = THREE.MathUtils.damp(hero.rightLeg.rotation.x, 0, 12, dt);
              hero.leftArm.rotation.x = THREE.MathUtils.damp(hero.leftArm.rotation.x, 0, 12, dt);
              hero.rightArm.rotation.x = THREE.MathUtils.damp(hero.rightArm.rotation.x, 0, 12, dt);
            }

            const rawNextX = THREE.MathUtils.clamp(sim.playerX + sim.playerVx * dt, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
            const rawNextZ = THREE.MathUtils.clamp(sim.playerZ + sim.playerVz * dt, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
            const footCol = resolveBuildingCollision(rawNextX, rawNextZ, 0.85);
            sim.playerX = footCol.x;
            sim.playerZ = footCol.z;

            // Vertical Jump & Gravity with Coyote Time
            const floorY = Math.max(-0.2, playableSurfaceHeightAt(sim.playerX, sim.playerZ));
            if (sim.isGrounded) {
              sim.coyoteTimer = 0.12;
            } else {
              sim.coyoteTimer = Math.max(0, sim.coyoteTimer - dt);
            }

            if (sim.jumpBufferTimer > 0) {
              sim.jumpBufferTimer = Math.max(0, sim.jumpBufferTimer - dt);
            }

            if (sim.jumpBufferTimer > 0 && sim.coyoteTimer > 0) {
              sim.playerVy = 11.2;
              sim.isGrounded = false;
              sim.coyoteTimer = 0;
              sim.jumpBufferTimer = 0;
              sim.squashY = 1.22;
              soundEngine.playJump();
            }

            sim.playerVy -= 26.0 * dt;
            sim.playerY += sim.playerVy * dt;

            if (sim.playerY <= floorY) {
              if (!sim.isGrounded && sim.playerVy < -4) {
                sim.squashY = 0.84;
              }
              sim.playerY = floorY;
              sim.playerVy = 0;
              sim.isGrounded = true;
            }

            sim.squashY = THREE.MathUtils.damp(sim.squashY, 1.0, 12, dt);
            hero.bodyGroup.scale.set(
              1 / Math.sqrt(sim.squashY),
              sim.squashY,
              1 / Math.sqrt(sim.squashY),
            );
            hero.group.position.set(sim.playerX, sim.playerY, sim.playerZ);
            hero.group.rotation.y = sim.playerHeading;
            }
          }

          // Update Active Food Delivery or Sitapu Street Time Trial Challenge
          if (sim.activeChallenge) {
            const ch = sim.activeChallenge;
            ch.timeRemainingSec -= dt;
            if (ch.timeRemainingSec <= 0) {
              sim.activeChallenge = null;
              sim.customWaypoint = null;
              soundEngine.playDamageTaken();
              showBanner(
                'အချိန်ကုန်သွားပါပြီ! (Time Up!)',
                'မစ်ရှင်ခလုတ်နှိပ်၍ ပြန်လည်ကြိုးစားနိုင်ပါသည်',
              );
            } else {
              const distToStop = Math.hypot(
                sim.playerX - ch.targetX,
                sim.playerZ - ch.targetZ,
              );
              const hitRadius = ch.type === 'timetrial' ? 8.5 : 7.5;
              if (distToStop < hitRadius) {
                soundEngine.playJadeCollect(3);
                spawnBurst(
                  ch.targetX,
                  playableSurfaceHeightAt(ch.targetX, ch.targetZ) + 1.8,
                  ch.targetZ,
                  ch.type === 'delivery' ? '#f59e0b' : '#10b981',
                  14,
                );
                ch.currentStep += 1;

                if (ch.type === 'delivery') {
                  const qDeliv = sim.quests.find((q) => q.id === 'quest_delivery');
                  if (qDeliv && !qDeliv.completed && ch.currentStep >= 1) {
                    qDeliv.progress = Math.min(qDeliv.goal, ch.currentStep - 1);
                  }
                  if (ch.currentStep >= DELIVERY_STOPS.length) {
                    const deliveryPayMmk = 35000;
                    sim.jadeCount += deliveryPayMmk;
                    sim.score += 600;
                    if (qDeliv) {
                      qDeliv.progress = qDeliv.goal;
                      qDeliv.completed = true;
                    }
                    sim.activeChallenge = null;
                    sim.customWaypoint = null;
                    soundEngine.playQuestComplete();
                    showBanner(
                      `ကချင်ထမင်းဟင်း ပို့ဆောင်ရေး အောင်မြင်ပြီ! (+${deliveryPayMmk.toLocaleString()} MMK)`,
                      'All 3 Sitapu Food Orders Delivered On Time!',
                    );
                  } else {
                    const nextStop = DELIVERY_STOPS[ch.currentStep];
                    ch.stepLabelMm = nextStop.labelMm;
                    ch.targetX = nextStop.x;
                    ch.targetZ = nextStop.z;
                    sim.customWaypoint = {
                      x: nextStop.x,
                      z: nextStop.z,
                      labelMm: nextStop.labelMm,
                    };
                    showBanner(
                      `အော်ဒါအဆင့် (${ch.currentStep}/${DELIVERY_STOPS.length - 1})`,
                      nextStop.labelMm,
                    );
                  }
                } else {
                  const qRace = sim.quests.find((q) => q.id === 'quest_timetrial');
                  if (qRace && !qRace.completed) {
                    qRace.progress = Math.min(qRace.goal, ch.currentStep);
                  }
                  if (ch.currentStep >= TIME_TRIAL_GATES.length) {
                    const racePayMmk = 45000;
                    sim.jadeCount += racePayMmk;
                    sim.score += 750;
                    if (qRace) {
                      qRace.progress = qRace.goal;
                      qRace.completed = true;
                    }
                    sim.activeChallenge = null;
                    sim.customWaypoint = null;
                    soundEngine.playQuestComplete();
                    showBanner(
                      `စီတာပူ မြစ်ကမ်းဘေး ပြိုင်ပွဲ အနိုင်ရရှိပြီ! (+${racePayMmk.toLocaleString()} MMK)`,
                      'Sitapu Riverside Street Time Trial Champion!',
                    );
                  } else {
                    const nextGate = TIME_TRIAL_GATES[ch.currentStep];
                    ch.stepLabelMm = nextGate.labelMm;
                    ch.targetX = nextGate.x;
                    ch.targetZ = nextGate.z;
                    sim.customWaypoint = {
                      x: nextGate.x,
                      z: nextGate.z,
                      labelMm: nextGate.labelMm,
                    };
                    showBanner(nextGate.labelMm, 'Keep Racing to Next Checkpoint!');
                  }
                }
              }
            }
          }

          updateMarkers(
            elapsed,
            sim.activeChallenge ? sim.activeChallenge.type : null,
            sim.activeChallenge ? sim.activeChallenge.targetX : 0,
            sim.activeChallenge ? sim.activeChallenge.targetZ : 0,
          );

          // Update GTA 3D Ground GPS Waypoint Ring around Player (Custom Waypoint or Active Quest)
          const activeQ = sim.quests.find((q) => !q.completed) || sim.quests[0];
          const wpX = sim.customWaypoint ? sim.customWaypoint.x : activeQ ? activeQ.targetX : -75;
          const wpZ = sim.customWaypoint ? sim.customWaypoint.z : activeQ ? activeQ.targetZ : 20;

          if (
            sim.customWaypoint &&
            !sim.activeChallenge &&
            !scenicRoute &&
            Math.hypot(sim.playerX - sim.customWaypoint.x, sim.playerZ - sim.customWaypoint.z) < 12
          ) {
            showBanner(
              `လမ်းညွှန်နေရာသို့ ရောက်ရှိပါပြီ: ${sim.customWaypoint.labelMm}`,
              'Arrived at Destination!',
            );
            sim.customWaypoint = null;
          }

          gpsGroup.position.set(sim.playerX, sim.playerY, sim.playerZ);
          const angleToTarget = Math.atan2(wpX - sim.playerX, wpZ - sim.playerZ);
          gpsGroup.rotation.y = angleToTarget;

          // Arcade Nitro Speed Boost Rings (⚡ TURBO RINGS — Speed & Stamina Only, No Free Money)
          for (const sr of speedRings) {
            if (sr.cooldown <= 0 && Math.hypot(sr.x - sim.playerX, sr.z - sim.playerZ) < 4.6) {
              sr.cooldown = 7.5;
              sr.group.visible = false;
              sim.score += 100;
              sim.stamina = 100;
              sim.health = Math.min(sim.maxHealth, sim.health + 15);
              sim.comboCount += 1;
              sim.comboTimer = 5.0;
              if (sim.activeVehicle) {
                sim.activeVehicle.speed = Math.min(42, Math.max(24, sim.activeVehicle.speed + 16));
              } else {
                sim.playerVx *= 1.45;
                sim.playerVz *= 1.45;
              }
              soundEngine.playJadeCollect(sim.comboCount);
              triggerShockwave(sr.x, sim.playerY, sr.z, '#06b6d4');
              spawnBurst(sr.x, sim.playerY + 1.5, sr.z, '#06b6d4', 14);
              showBanner(
                `⚡ NITRO TURBO BOOST!`,
                `အမြန်နှုန်းနှင့် အားအင် (Stamina 100%) တိုးမြင့်သွားပါပြီ! (${sim.comboCount}x Combo)`,
              );
            }
          }

          // Relaxed scenic route: glide through glowing rings, a caption at each stop, no timer
          if (scenicRoute) {
            const route = SCENIC_ROUTES[scenicRoute.id];
            const stop = route.stops[scenicRoute.idx];
            scenicRing.visible = true;
            scenicRing.position.set(stop.x, groundHeightAt(stop.x, stop.z) + 2.4, stop.z);
            scenicRing.rotation.y += dt * 0.6;
            sim.customWaypoint = { x: stop.x, z: stop.z, labelMm: route.titleMm };
            if (scenicRoute.id === 'morning_jog') sim.stamina = 100;
            if (Math.hypot(stop.x - sim.playerX, stop.z - sim.playerZ) < 9) {
              soundEngine.playJadeCollect(1);
              scenicRoute.idx += 1;
              if (scenicRoute.idx >= route.stops.length) {
                sim.jadeCount += route.rewardMmk;
                showBanner(`🌅 ${route.titleMm} — ပြီးဆုံးပါပြီ`, `${stop.captionMm} (+${route.rewardMmk.toLocaleString()} MMK)`);
                scenicRoute = null;
                scenicRing.visible = false;
                sim.customWaypoint = null;
              } else {
                showBanner(`${route.titleMm} (${scenicRoute.idx}/${route.stops.length})`, stop.captionMm);
              }
            }
          }

          // Station porter quest: pick up luggage at the station, deliver it to the hotel in time
          const qStation = sim.quests.find((q) => q.id === 'quest_station');
          if (qStation && !qStation.completed) {
            const carrying = qStation.progress >= 1;
            const stop = carrying ? STATION_QUEST.dropoff : STATION_QUEST.pickup;
            qStation.targetRegion = carrying ? 'downtown_market' : 'railway_station';
            qStation.targetX = stop.x;
            qStation.targetZ = stop.z;
            stationMarker.visible = true;
            stationMarker.position.set(stop.x, groundHeightAt(stop.x, stop.z), stop.z);
            stationMarker.children[0].rotation.y += dt * 1.6;
            stationMarker.children[0].position.y = 1.1 + Math.sin(elapsed * 3) * 0.12;

            // A loaded save may resume mid-delivery: give a fresh timer
            if (carrying && stationTimer <= 0) stationTimer = STATION_QUEST.timeLimitSec;

            if (carrying) {
              stationTimer -= dt;
              if (!stationWarned && stationTimer < 30) {
                stationWarned = true;
                showBanner('⏱ ခရီးဆောင်အိတ် ပို့ရန် စက္ကန့် ၃၀ သာ ကျန်ပါပြီ!', `${STATION_QUEST.hotelNameMm} သို့ အမြန်သွားပါ`);
              }
              if (stationTimer <= 0) {
                qStation.progress = 0;
                stationTimer = 0;
                stationWarned = false;
                soundEngine.playSplash(false);
                showBanner(
                  '⌛ အချိန်ကုန်သွားပါပြီ — ခရီးသည်က အိတ်ကို ပြန်ယူသွားပါပြီ',
                  'မီးရထားဘူတာသို့ ပြန်သွားပြီး ထပ်ကြိုးစားပါ',
                );
              }
            }

            if (Math.hypot(stop.x - sim.playerX, stop.z - sim.playerZ) < 4.5) {
              if (!carrying) {
                qStation.progress = 1;
                stationTimer = STATION_QUEST.timeLimitSec;
                stationWarned = false;
                soundEngine.playJadeCollect(2);
                spawnBurst(stop.x, sim.playerY + 1.6, stop.z, '#f59e0b', 16);
                showBanner(
                  '🧳 ခရီးဆောင်အိတ် ယူပြီးပါပြီ!',
                  `${STATION_QUEST.hotelNameMm} သို့ စက္ကန့် ${STATION_QUEST.timeLimitSec} အတွင်း ပို့ပါ (GPS လမ်းညွှန်အတိုင်း)`,
                );
              } else {
                qStation.progress = qStation.goal;
                qStation.completed = true;
                stationTimer = 0;
                stationMarker.visible = false;
                sim.jadeCount += qStation.rewardJade;
                sim.score += 700;
                soundEngine.playQuestComplete();
                spawnBurst(stop.x, sim.playerY + 1.8, stop.z, '#10b981', 22);
                showBanner(
                  `🏆 ဘူတာရုံ ပစ္စည်းထမ်း မစ်ရှင် အောင်မြင်ပြီ! +${qStation.rewardJade.toLocaleString()} MMK`,
                  'ခရီးသည်က ကျေးဇူးတင်ပါတယ်တဲ့ — Station Porter Complete!',
                );
              }
            }
          } else {
            stationMarker.visible = false;
          }

          // City Tour quest: visit landmarks in order (target follows the next stop)
          const qTour = sim.quests.find((q) => q.id === 'quest_explorer');
          if (qTour && !qTour.completed) {
            const stopId = CITY_TOUR_STOP_IDS[qTour.progress];
            const stop = MYITKYINA_LANDMARKS.find((l) => l.id === stopId);
            if (stop) {
              qTour.targetRegion = stop.id;
              qTour.targetX = stop.x;
              qTour.targetZ = stop.z;
              const arriveRadius = Math.min(40, stop.radius * 0.35);
              if (Math.hypot(stop.x - sim.playerX, stop.z - sim.playerZ) < arriveRadius) {
                qTour.progress += 1;
                soundEngine.playJadeCollect(3);
                spawnBurst(sim.playerX, sim.playerY + 1.8, sim.playerZ, stop.color, 18);
                if (qTour.progress >= qTour.goal) {
                  qTour.completed = true;
                  sim.jadeCount += qTour.rewardJade;
                  sim.score += 1000;
                  soundEngine.playQuestComplete();
                  showBanner(
                    `🏆 မြို့ပတ်ခရီး ပြီးဆုံးပြီ! +${qTour.rewardJade.toLocaleString()} MMK`,
                    'Myitkyina City Tour Complete!',
                  );
                } else {
                  const next = MYITKYINA_LANDMARKS.find(
                    (l) => l.id === CITY_TOUR_STOP_IDS[qTour.progress],
                  );
                  showBanner(
                    `📍 ${stop.nameMm} ရောက်ပြီ (${qTour.progress}/${qTour.goal})`,
                    next ? `နောက်တစ်နေရာ: ${next.nameMm}` : stop.nameEn,
                  );
                }
              }
            }
          }

          // Balaminhtin Bridge Checkpoints
          for (const cp of bridgeCheckpoints) {
            if (!cp.passed && Math.hypot(cp.x - sim.playerX, cp.z - sim.playerZ) < 6.8) {
              cp.passed = true;
              cp.mesh.visible = false;
              soundEngine.playJadeCollect(2);
              spawnBurst(cp.x, playableSurfaceHeightAt(cp.x, cp.z) + 1.5, cp.z, '#38bdf8', 12);

              const qBridge = sim.quests.find((q) => q.id === 'quest_bridge');
              if (qBridge && !qBridge.completed) {
                qBridge.progress = Math.min(qBridge.goal, qBridge.progress + 1);
                if (qBridge.progress >= qBridge.goal) {
                  qBridge.completed = true;
                  sim.jadeCount += qBridge.rewardJade;
                  soundEngine.playQuestComplete();
                  showBanner(
                    'ကမ်းနားလမ်း ဂိတ်များ ဖြတ်ပြီးပြီ!',
                    `Strand Road Riverside Run Complete! +${qBridge.rewardJade.toLocaleString()} MMK`,
                  );
                } else {
                  showBanner(
                    `ကမ်းနားလမ်း ဂိတ် (${qBridge.progress}/${qBridge.goal})`,
                    'Strand Road Checkpoint Cleared!',
                  );
                }
              }
            }
          }

          // Enemies
          for (const enemy of enemies) {
            if (!enemy.alive) continue;

            if (enemy.hitFlashTimer > 0) {
              enemy.hitFlashTimer -= dt;
              (enemy.bodyMesh.material as THREE.MeshStandardMaterial).color.copy(_hitColor);
            } else {
              (enemy.bodyMesh.material as THREE.MeshStandardMaterial).color.copy(_baseEnemyColor);
            }

            const dx = sim.playerX - enemy.x;
            const dz = sim.playerZ - enemy.z;
            const distToPlayer = Math.hypot(dx, dz);

            if (
              sim.activeVehicle &&
              Math.abs(sim.activeVehicle.speed) > 6 &&
              distToPlayer < 3.8
            ) {
              enemy.hp = 0;
              enemy.alive = false;
              enemy.group.visible = false;
              sim.hitstopTimer = 0.04;
              soundEngine.playHeavyImpact();
              spawnBurst(enemy.x, groundHeightAt(enemy.x, enemy.z) + 1.2, enemy.z, '#ef4444', 14);
              sim.score += 250;
              sim.jadeCount += 5000;
              const qSmug = sim.quests.find((q) => q.id === 'quest_smugglers');
              if (qSmug && !qSmug.completed) {
                qSmug.progress = Math.min(qSmug.goal, qSmug.progress + 1);
                if (qSmug.progress >= qSmug.goal) {
                  qSmug.completed = true;
                  sim.jadeCount += qSmug.rewardJade;
                  soundEngine.playQuestComplete();
                  showBanner(
                    'ကမ်းနား လုံခြုံရေး အောင်မြင်ပြီ!',
                    `All Rogue Smugglers Cleared! +${qSmug.rewardJade.toLocaleString()} MMK`,
                  );
                }
              }
              continue;
            }

            enemy.stateTimer += dt;
            if (enemy.state === 'patrol') {
              (enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
              if (distToPlayer < 20 && !sim.isFishing) {
                enemy.heading = Math.atan2(dx, dz);
                enemy.x += Math.sin(enemy.heading) * 4.4 * dt;
                enemy.z += Math.cos(enemy.heading) * 4.4 * dt;
                if (distToPlayer < 4.2) {
                  enemy.state = 'windup';
                  enemy.stateTimer = 0;
                }
              } else {
                const patrolAngle = elapsed * 0.7 + enemy.homeX;
                enemy.x = enemy.homeX + Math.cos(patrolAngle) * 5;
                enemy.z = enemy.homeZ + Math.sin(patrolAngle) * 5;
                enemy.heading = patrolAngle + Math.PI / 2;
              }
            } else if (enemy.state === 'windup') {
              enemy.heading = Math.atan2(dx, dz);
              const windupRatio = Math.min(1, enemy.stateTimer / 0.85);
              (enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity =
                0.25 + windupRatio * 0.65;
              enemy.telegraphRing.scale.setScalar(0.5 + windupRatio * 0.6);

              if (enemy.stateTimer >= 0.85) {
                enemy.state = 'lunge';
                enemy.stateTimer = 0;
              }
            } else if (enemy.state === 'lunge') {
              enemy.x += Math.sin(enemy.heading) * 14 * dt;
              enemy.z += Math.cos(enemy.heading) * 14 * dt;
              if (distToPlayer < 2.5 && !sim.isFishing) {
                sim.health = Math.max(0, sim.health - 12);
                soundEngine.playDamageTaken();
                enemy.state = 'cooldown';
                enemy.stateTimer = 0;
                if (sim.health <= 0) {
                  sim.phase = 'gameover';
                }
              } else if (enemy.stateTimer >= 0.32) {
                enemy.state = 'cooldown';
                enemy.stateTimer = 0;
              }
            } else if (enemy.state === 'cooldown') {
              (enemy.telegraphRing.material as THREE.MeshBasicMaterial).opacity = 0;
              if (enemy.stateTimer >= 1.2) {
                enemy.state = 'patrol';
                enemy.stateTimer = 0;
              }
            }

            const ey = Math.max(0.4, groundHeightAt(enemy.x, enemy.z));
            enemy.group.position.set(enemy.x, ey, enemy.z);
            enemy.group.rotation.y = enemy.heading;
          }

          if (sim.quests.every((q) => q.completed) && sim.phase === 'playing') {
            sim.phase = 'victory';
            clearSave(); // မစ်ရှင်အားလုံးပြီး — နောက်တစ်ကြိမ် အစမှ ပြန်စရန်
            soundEngine.playQuestComplete();
          }

          for (const p of particlePool) {
            if (p.life > 0) {
              p.life -= dt;
              p.vy -= 14 * dt;
              p.mesh.position.x += p.vx * dt;
              p.mesh.position.y += p.vy * dt;
              p.mesh.position.z += p.vz * dt;
              p.mesh.rotation.x += 5 * dt;
              (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
                0,
                p.life / p.maxLife,
              );
              if (p.life <= 0) {
                p.mesh.visible = false;
              }
            }
          }

          // =========================================================================
          // SILKY-SMOOTH, ZERO-NAUSEA GTA THIRD-PERSON & OVERHEAD CAMERA RIG
          // =========================================================================
          const yawErr = shortestAngleDiff(sim.cameraYaw, sim.cameraYawTarget);
          sim.cameraYaw += yawErr * (1 - Math.exp(-7.0 * dt));

          if (sim.cameraMode === 'overhead') {
            // Overhead Bird's-Eye Camera locked North-Up (-Z at top) to match the Mini Map 1:1
            sim.cameraYaw = Math.PI;
            sim.cameraYawTarget = Math.PI;
            _camTargetPos.set(sim.playerX, sim.playerY + 185, sim.playerZ + 12);
            camera.position.lerp(_camTargetPos, 1 - Math.exp(-6.5 * dt));
            _camLookTarget.set(sim.playerX, sim.playerY, sim.playerZ);
            _smoothLookAt.lerp(_camLookTarget, 1 - Math.exp(-10.0 * dt));
            camera.lookAt(_smoothLookAt);
          } else {
            const camDist =
              sim.cameraMode === 'chase'
                ? sim.activeVehicle
                  ? 14.5
                  : 11.2
                : sim.cameraMode === 'high'
                  ? 22.0
                  : 16.0;

            const pitchAngle =
              sim.cameraMode === 'high' ? 0.58 : sim.cameraPitch;

            const effectiveYaw =
              sim.cameraMode === 'cinematic'
                ? elapsed * 0.22
                : sim.cameraYaw;

            const horizDist = Math.cos(pitchAngle) * camDist;
            const vertHeight = Math.sin(pitchAngle) * camDist + (sim.activeVehicle ? 2.2 : 1.8);

            _camTargetPos.set(
              sim.playerX - Math.sin(effectiveYaw) * horizDist,
              sim.playerY + vertHeight,
              sim.playerZ - Math.cos(effectiveYaw) * horizDist,
            );

            const terrainUnderCam = groundHeightAt(_camTargetPos.x, _camTargetPos.z) + 2.0;
            if (_camTargetPos.y < terrainUnderCam) {
              _camTargetPos.y = terrainUnderCam;
            }

            // Smooth exponential camera position & lookAt damping (no abrupt snaps or wobble)
            camera.position.lerp(_camTargetPos, 1 - Math.exp(-6.5 * dt));

            _camLookTarget.set(
              sim.isFishing ? sim.playerX + 4.5 : sim.playerX,
              sim.playerY + (sim.isFishing ? 1.1 : 1.8),
              sim.playerZ,
            );
            _smoothLookAt.lerp(_camLookTarget, 1 - Math.exp(-10.0 * dt));
            camera.lookAt(_smoothLookAt);
          }

          sunLight.position.set(
            sim.playerX + TIME_PALETTES[sim.timeOfDay].sunPos[0],
            TIME_PALETTES[sim.timeOfDay].sunPos[1],
            sim.playerZ + TIME_PALETTES[sim.timeOfDay].sunPos[2],
          );
          sunLight.target.position.set(sim.playerX, sim.playerY, sim.playerZ);
        }
      }

      renderer.render(scene, camera);

      const nowMs = performance.now();
      fpsFrames++;
      if (nowMs - fpsWindowStart >= 500) {
        const fps = Math.round((fpsFrames * 1000) / (nowMs - fpsWindowStart));
        fpsFrames = 0;
        fpsWindowStart = nowMs;
        if (fpsLabelRef.current) fpsLabelRef.current.textContent = `${fps} FPS`;
      }
      if (sim.phase === 'playing' && nowMs - lastAutosaveMs > AUTOSAVE_INTERVAL_MS) {
        persistGame();
      }
      const hudEmitInterval = sim.isManauDancing || sim.isFishing ? 50 : 90;
      if (nowMs - lastHudEmit > hudEmitInterval) {
        lastHudEmit = nowMs;

        let currentRegion = MYITKYINA_LANDMARKS[0];
        let bestDist = Infinity;
        for (const lm of MYITKYINA_LANDMARKS) {
          const d = Math.hypot(lm.x - sim.playerX, lm.z - sim.playerZ);
          if (d < bestDist) {
            bestDist = d;
            currentRegion = lm;
          }
        }

        let nearVehicle: HUDState['nearVehicle'] = null;
        if (!sim.activeVehicle && !sim.isFishing) {
          let minVD = 8.0;
          for (const v of vehicles) {
            const d = Math.hypot(v.x - sim.playerX, v.z - sim.playerZ);
            if (d < minVD) {
              minVD = d;
              nearVehicle = { id: v.id, type: v.type, label: v.label, dist: Math.round(d) };
            }
          }
        }

        let nearInteractable: HUDState['nearInteractable'] = null;
        for (const npc of MYITKYINA_INTERACTIVE_NPCS) {
          if (Math.hypot(npc.x - sim.playerX, npc.z - sim.playerZ) < 8.5) {
            const roleIcon =
              npc.role === 'shopkeeper' ? '🛒' : npc.role === 'quest_giver' ? '📜' : '💬';
            nearInteractable = {
              id: npc.id,
              labelMm: `${roleIcon} ${npc.nameMm} (${npc.roleLabelMm}) နှင့် စကားပြောရန် [E]`,
              labelEn: `Talk / Trade with ${npc.nameEn}`,
            };
            break;
          }
        }
        if (!nearInteractable) {
          for (const spot of fishingSpots) {
            if (Math.hypot(spot.x - sim.playerX, spot.z - sim.playerZ) < 12.5) {
              nearInteractable = {
                id: spot.id,
                labelMm: sim.isFishing
                  ? '🎣 ငါးမျှားဂိမ်း ကစားနေသည် [SPACE / E]'
                  : `🎣 ${spot.nameMm} တွင် ငါးမျှားရန် [E]`,
                labelEn: 'Start Ayeyarwady & Balaminhtin Bridge Fishing Mini-Game',
              };
              break;
            }
          }
        }
        if (!nearInteractable) {
          for (const drum of manauDrums) {
            if (!drum.activated && Math.hypot(drum.x - sim.playerX, drum.z - sim.playerZ) < 5.5) {
              nearInteractable = {
                id: drum.id,
                labelMm: 'မနောစည်တော် တီးခတ်ရန် [E]',
                labelEn: 'Tap Action to Strike Manau Drum',
              };
              break;
            }
          }
        }
        if (
          !nearInteractable &&
          !peaceBell.rung &&
          Math.hypot(peaceBell.x - sim.playerX, peaceBell.z - sim.playerZ) < 6.8
        ) {
          nearInteractable = {
            id: 'peace_bell',
            labelMm: 'ငြိမ်းချမ်းရေးခေါင်းလောင်း တီးခတ်ရန် [E]',
            labelEn: 'Tap Action to Ring Peace Bell',
          };
        }
        if (!nearInteractable) {
          for (const b of MYITKYINA_FAMOUS_BUILDINGS) {
            if (b.interactPromptMm && Math.hypot(b.x - sim.playerX, b.z - sim.playerZ) < 12.5) {
              if (b.id === 'bldg_fish_shop_sitapu' || b.id === 'bldg_fish_shop_bridge') {
                const basketSum = sim.fishingBasket.reduce((s, f) => s + f.priceMmk, 0);
                nearInteractable = {
                  id: b.id,
                  labelMm:
                    sim.fishingBasket.length > 0
                      ? `💰 ငါး (${sim.fishingBasket.length}) ကောင် ရောင်းမည် (+${basketSum.toLocaleString()} MMK) [E]`
                      : sim.fishingRodLevel === 0
                        ? '🛒 အခြေခံ ဝါးငါးမျှားတံ ဝယ်မည် (30,000 MMK) [E]'
                        : sim.fishingRodLevel < 3
                          ? `⬆️ ငါးမျှားတံ Lv.${sim.fishingRodLevel + 1} အဆင့်မြှင့်မည် (${FISHING_GEAR_TIERS[sim.fishingRodLevel + 1].priceMmk.toLocaleString()} MMK) [E]`
                          : `${b.nameMm} [E]`,
                  labelEn: 'Sell Caught Fish for MMK or Buy/Upgrade Fishing Gear',
                };
              } else {
                nearInteractable = {
                  id: b.id,
                  labelMm: b.interactPromptMm,
                  labelEn: `${b.nameEn} — Restore HP & Stamina`,
                };
              }
              break;
            }
          }
        }
        if (!nearInteractable && Math.hypot(sim.playerX - 68, sim.playerZ - 224) < 18) {
          nearInteractable = {
            id: 'pagoda_pray',
            labelMm: '🙏 ဆုတောင်းပြည့်စေတီတွင် ရွှေသင်္ကန်းကပ်လှူ ဆုတောင်းရန် [E]',
            labelEn: 'Offer Gold Leaf & Pray at Sutaungpyae Pagoda',
          };
        }
        if (
          !nearInteractable &&
          !sim.activeVehicle &&
          Math.hypot(sim.playerX, sim.playerZ - 7) < 22
        ) {
          nearInteractable = {
            id: 'manau_dance',
            labelMm: sim.isManauDancing
              ? '💃 မနောအက ရပ်နားရန် [E]'
              : '💃 မနောကွင်းတွင် ရိုးရာမနောအက သံစဉ်မစ်ရှင် ဝင်ကရန် [E]',
            labelEn: 'Join Traditional Kachin Manau Rhythm Dance Quest',
          };
        }

        const minimapEntities: MinimapEntity[] = [
          ...enemies.map((e) => ({
            id: e.id,
            x: e.x,
            z: e.z,
            type: 'enemy' as const,
            active: e.alive,
          })),
          ...vehicles.map((v) => ({
            id: v.id,
            x: v.x,
            z: v.z,
            type: 'vehicle' as const,
            active: sim.activeVehicle?.id !== v.id,
          })),
          ...manauDrums.map((d) => ({
            id: d.id,
            x: d.x,
            z: d.z,
            type: 'totem' as const,
            active: !d.activated,
          })),
          ...aiTrafficAgents.map((ag) => ({
            id: ag.id,
            x: ag.x,
            z: ag.z,
            type: 'traffic' as const,
            active: true,
          })),
        ];

        const activeQuestIdx = Math.max(
          0,
          sim.quests.findIndex((q) => !q.completed),
        );

        const activeQuestObj = sim.quests[activeQuestIdx] || sim.quests[0];
        const finalWpX = sim.customWaypoint
          ? sim.customWaypoint.x
          : activeQuestObj
            ? activeQuestObj.targetX
            : -75;
        const finalWpZ = sim.customWaypoint
          ? sim.customWaypoint.z
          : activeQuestObj
            ? activeQuestObj.targetZ
            : 20;
        const finalWpLabel = sim.customWaypoint
          ? sim.customWaypoint.labelMm
          : activeQuestObj
            ? activeQuestObj.titleMm
            : 'စီတာပူ မနောကွင်း';

        const qRhythmObj = sim.quests.find((q) => q.id === 'quest_manau_rhythm');
        const currentRhythmKey =
          MANAU_DANCE_PATTERN[sim.rhythmStepIndex % MANAU_DANCE_PATTERN.length];
        const upcomingQueue: ManauBeatKey[] = [
          MANAU_DANCE_PATTERN[(sim.rhythmStepIndex + 1) % MANAU_DANCE_PATTERN.length],
          MANAU_DANCE_PATTERN[(sim.rhythmStepIndex + 2) % MANAU_DANCE_PATTERN.length],
          MANAU_DANCE_PATTERN[(sim.rhythmStepIndex + 3) % MANAU_DANCE_PATTERN.length],
        ];

        const currentGear = FISHING_GEAR_TIERS[sim.fishingRodLevel];
        const nextGear =
          sim.fishingRodLevel < 3 ? FISHING_GEAR_TIERS[sim.fishingRodLevel + 1] : null;
        const basketValueMmk = sim.fishingBasket.reduce((s, f) => s + f.priceMmk, 0);

        onHudUpdate({
          phase: sim.phase,
          health: Math.round(sim.health),
          maxHealth: sim.maxHealth,
          stamina: Math.round(sim.stamina),
          jadeCount: sim.jadeCount,
          totalJadeInWorld: 0,
          score: sim.score,
          meritLevel: sim.meritLevel,
          currentRegion,
          activeVehicle: sim.activeVehicle ? sim.activeVehicle.type : 'none',
          nearVehicle,
          nearInteractable,
          speedKmh: sim.activeVehicle
            ? Math.round(Math.abs(sim.activeVehicle.speed) * 3.2)
            : 0,
          playerX: Math.round(sim.playerX),
          playerZ: Math.round(sim.playerZ),
          playerHeading: sim.playerHeading,
          cameraYaw: sim.cameraYaw,
          waypointX: Math.round(finalWpX),
          waypointZ: Math.round(finalWpZ),
          waypointLabelMm: finalWpLabel,
          quests: sim.quests.map((q) => ({ ...q })),
          activeQuestIndex: activeQuestIdx,
          enemiesRemaining: enemies.filter((e) => e.alive).length,
          totemsActivated: manauDrums.filter((d) => d.activated).length,
          timeOfDay: sim.timeOfDay,
          weather: sim.weather,
          activeChallenge: sim.activeChallenge ? { ...sim.activeChallenge } : null,
          cameraMode: sim.cameraMode,
          isMuted: soundEngine.getMuted(),
          notification:
            sim.notification && nowMs - sim.notification.timestamp < 4200
              ? sim.notification
              : null,
          minimapEntities,
          comboCount: sim.comboCount,
          isManauDancing: sim.isManauDancing,
          manauRhythm: {
            active: sim.isManauDancing,
            hitsCompleted: sim.rhythmHitsCompleted,
            hitsGoal: sim.rhythmHitsGoal,
            streak: sim.rhythmStreak,
            currentBeatKey: currentRhythmKey,
            beatProgress: Math.min(1, sim.rhythmBeatTimer / sim.rhythmBeatDuration),
            upcomingQueue,
            lastRating: sim.rhythmLastRating,
            lastRatingTextMm: sim.rhythmLastRatingTextMm,
            questCompleted: Boolean(qRhythmObj?.completed),
          },
          fishing: {
            active: sim.isFishing,
            spotNameMm: sim.activeFishingSpot.nameMm,
            phase: sim.fishingPhase,
            rodLevel: sim.fishingRodLevel,
            rodNameMm: currentGear.nameMm,
            rodCapabilityMm: currentGear.capabilityMm,
            nextUpgradeCostMmk: nextGear ? nextGear.priceMmk : null,
            nextUpgradeNameMm: nextGear ? nextGear.nameMm : null,
            fishPosition: Math.round(sim.fishingFishPos),
            barPosition: Math.round(sim.fishingBarPos),
            barHalfWidth: currentGear.barHalfWidth || 13,
            reelProgress: Math.round(sim.fishingReelProgress),
            totalCaught: sim.fishingTotalCaught,
            totalSoldCount: sim.fishingTotalSold,
            totalEarnedMmk: sim.fishingTotalEarnedMmk,
            biggestKg: sim.fishingBiggestKg,
            lastCatch: sim.fishingLastCatch,
            fishBasket: sim.fishingBasket,
            basketValueMmk,
            caughtSpecies: sim.fishingCaughtSpecies,
            messageMm: sim.fishingMessageMm,
          },
          musicTrack: soundEngine.getCurrentTrack(),
          musicTrackLabel: soundEngine.getCurrentTrackLabel(),
          hasCustomSong: soundEngine.hasCustomSong(),
          osm3d: {
            loaded: sim.osmLoaded,
            visible: sim.osmVisible,
            debugMode: sim.osmDebugMode,
            sourceName: sim.osmSourceName,
            buildingsCount: sim.osmBuildingsCount,
            roadsCount: sim.osmRoadsCount,
            nearbyBuildings150m: sim.osmNearbyBuildings150m,
            nearestRoadName: sim.osmNearestRoadName,
            nearestRoadDistM: sim.osmNearestRoadDistM,
            bbox: sim.osmBbox,
            citySpawnPoints: sim.osmCitySpawnPoints,
            namedPlaces: sim.osmNamedPlaces,
            roadPolylines: sim.osmRoadPolylines,
            buildingFootprints: sim.osmBuildingFootprints,
          },
          activeNpcDialogue: sim.activeNpcDialogue,
        });
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const applyPlayerSettings = (next: typeof playerSettings) => {
      playerSettings = next;
      quality = QUALITY_PROFILES[next.graphicsQuality];
      soundEngine.setVolumes(next.musicVolume, next.sfxVolume);
      if (fpsLabelRef.current) fpsLabelRef.current.style.display = next.showFps ? 'block' : 'none';
      if (!isSoftwareGl) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.maxPixelRatio));
        renderer.setSize(container.clientWidth, container.clientHeight);
        const shadowsOn = quality.shadows;
        if (renderer.shadowMap.enabled !== shadowsOn) {
          renderer.shadowMap.enabled = shadowsOn;
          sunLight.castShadow = shadowsOn;
          // Materials must recompile when shadow support toggles
          scene.traverse((obj) => {
            const mat = (obj as THREE.Mesh).material;
            if (Array.isArray(mat)) mat.forEach((m) => (m.needsUpdate = true));
            else if (mat) mat.needsUpdate = true;
          });
        }
        if (sunLight.shadow.mapSize.x !== quality.shadowMapSize) {
          sunLight.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
          sunLight.shadow.map?.dispose();
          sunLight.shadow.map = null;
        }
      }
      camera.far = quality.viewDistance;
      camera.updateProjectionMatrix();
      applyAtmosphere(sim.timeOfDay, sim.weather);
    };
    const unsubscribeSettings = onSettingsChanged(applyPlayerSettings);
    applyPlayerSettings(playerSettings);

    return () => {
      isDisposed = true;
      unsubscribeSettings();
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearHeldInputs);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      domElem.removeEventListener('mousedown', onPointerDown);
      domElem.removeEventListener('touchstart', onTouchStart);
      domElem.removeEventListener('touchmove', onTouchMove);
      domElem.removeEventListener('touchend', onTouchEnd);
      domElem.removeEventListener('touchcancel', onTouchEnd);
      renderer.dispose();
    };
  }, [controllerRef, onHudUpdate]);

  return (
    <>
      <div
        ref={canvasMountRef}
        className="fixed inset-0 w-full h-full overflow-hidden bg-[#080d0b] touch-none"
        aria-label="Myitkyina 3D Open World Viewport"
      />
      <div
        ref={fpsLabelRef}
        className="fixed bottom-1 right-2 z-40 pointer-events-none font-mono text-[10px] text-emerald-300/80"
        style={{ display: 'none' }}
      />
    </>
  );
};
