import {
  MAP_ORIGIN,
  METERS_PER_DEG_LAT,
  METERS_PER_DEG_LNG,
  BUILDING_DENSITY,
  OSM_NAMED_PLACES,
  OSM_ROAD_SEGMENTS,
  RIVER_POINTS,
} from '../world/mapData.generated';
import { reserveLot, roadsidePoint } from '../world/worldLayout';

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type TimeOfDay = 'morning' | 'noon' | 'sunset' | 'night';

export type WeatherMode = 'clear' | 'mist' | 'rain';

export type CameraMode = 'chase' | 'high' | 'cinematic' | 'overhead';

export type VehicleType = 'none' | 'ebike' | 'hilux4x4' | 'tuktuk' | 'riverboat';

export type RegionId =
  | 'manau_park'
  | 'downtown_market'
  | 'railway_station'
  | 'pagoda_riverfront'
  | 'strand_road'
  | 'kachin_baptist';

export interface LandmarkInfo {
  id: RegionId;
  nameMm: string;
  nameEn: string;
  quarterMm: string;
  subtitle: string;
  x: number;
  z: number;
  lat: number;
  lng: number;
  radius: number;
  color: string;
}

export interface FamousBuildingInfo {
  id: string;
  nameMm: string;
  nameEn: string;
  quarterMm: string;
  category: 'restaurant' | 'cafe' | 'hotel' | 'shopping' | 'university' | 'station' | 'market';
  x: number;
  z: number;
  lat: number;
  lng: number;
  width: number;
  depth: number;
  height: number;
  roofShape: 'gable' | 'hipped' | 'courtyard' | 'modern_stepped' | 'colonnade';
  color: string;
  accentColor: string;
  interactPromptMm?: string;
  buffDescriptionMm?: string;
}

export type RoadSurfaceType = 'asphalt' | 'concrete' | 'laterite_dirt' | 'riverside_sand';

export interface RoadSegmentDef {
  id: string;
  nameMm: string;
  surface: RoadSurfaceType;
  width: number;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
}

export interface QuestObjective {
  id: string;
  titleMm: string;
  titleEn: string;
  descriptionMm: string;
  targetRegion: RegionId;
  targetX: number;
  targetZ: number;
  progress: number;
  goal: number;
  rewardJade: number;
  completed: boolean;
}

export interface MinimapEntity {
  id: string;
  x: number;
  z: number;
  type: 'jade' | 'enemy' | 'vehicle' | 'totem' | 'quest' | 'traffic';
  active: boolean;
}

export interface ActiveChallengeState {
  type: 'delivery' | 'timetrial';
  titleMm: string;
  stepLabelMm: string;
  currentStep: number;
  totalSteps: number;
  timeRemainingSec: number;
  targetX: number;
  targetZ: number;
}

export type ManauBeatKey = 'left' | 'up' | 'down' | 'right';

export type ManauHitRating = 'PERFECT' | 'GOOD' | 'MISS' | null;

export interface ManauRhythmState {
  active: boolean;
  hitsCompleted: number;
  hitsGoal: number;
  streak: number;
  currentBeatKey: ManauBeatKey;
  beatProgress: number; // 0.0 -> 1.0 (Sweet spot hit window: 0.55 - 0.98)
  upcomingQueue: ManauBeatKey[];
  lastRating: ManauHitRating;
  lastRatingTextMm: string;
  questCompleted: boolean;
}

export type FishingPhase = 'inactive' | 'no_gear' | 'ready' | 'waiting' | 'bite' | 'reeling' | 'caught';

export type FishingRodLevel = 0 | 1 | 2 | 3;

export interface FishingGearTierInfo {
  level: FishingRodLevel;
  nameMm: string;
  nameEn: string;
  capabilityMm: string;
  priceMmk: number;
  barHalfWidth: number;
  reelRate: number;
  valueMultiplier: number;
}

export const FISHING_GEAR_TIERS: FishingGearTierInfo[] = [
  {
    level: 0,
    nameMm: 'ငါးမျှားကိရိယာ မရှိသေးပါ (No Fishing Gear)',
    nameEn: 'No Fishing Equipment',
    capabilityMm: 'ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) အရင်ဝယ်ယူရပါမည်',
    priceMmk: 0,
    barHalfWidth: 0,
    reelRate: 0,
    valueMultiplier: 0,
  },
  {
    level: 1,
    nameMm: 'အခြေခံ ဝါးငါးမျှားတံ (Budget Bamboo Rod)',
    nameEn: 'Budget Bamboo Fishing Gear (Lv.1)',
    capabilityMm: 'အခြေခံအဆင့် (Low Capability) — ငါးအသေး/အလတ် ဖမ်းနိုင်သည် (1.0x ဈေးနှုန်း)',
    priceMmk: 30000,
    barHalfWidth: 13,
    reelRate: 25,
    valueMultiplier: 1.0,
  },
  {
    level: 2,
    nameMm: 'အလယ်အလတ် ဖိုက်ဘာ ငါးမျှားတံ (Fiberglass Spin Rod)',
    nameEn: 'Upgraded Fiberglass Rod (Lv.2)',
    capabilityMm: 'အလယ်အလတ်အဆင့် (Medium Capability) — ဖမ်းရလွယ်ကူပြီး ငါးအကြီးဖမ်းနိုင်သည် (1.6x ဝင်ငွေတိုး)',
    priceMmk: 75000,
    barHalfWidth: 21,
    reelRate: 37,
    valueMultiplier: 1.6,
  },
  {
    level: 3,
    nameMm: 'ပရို ဧရာဝတီ ရွှေငါးမျှားစက် (Master Pro Reel)',
    nameEn: 'Pro Ayeyarwady Master Reel (Lv.3)',
    capabilityMm: 'အမြင့်ဆုံးအဆင့် (High Capability) — ဗလမင်းထင် ငါးတန်ကြီးနှင့် ရှားပါးငါးကြီးများ အလွယ်တကူဖမ်းနိုင်သည် (2.5x ဝင်ငွေတိုး)',
    priceMmk: 160000,
    barHalfWidth: 28,
    reelRate: 50,
    valueMultiplier: 2.5,
  },
];

export interface FishCatchInfo {
  id: string;
  nameMm: string;
  nameEn: string;
  weightKg: number;
  rarity: 'common' | 'rare' | 'legendary';
  priceMmk: number;
  icon: string;
}

export interface FishingMiniGameState {
  active: boolean;
  spotNameMm: string;
  phase: FishingPhase;
  rodLevel: FishingRodLevel;
  rodNameMm: string;
  rodCapabilityMm: string;
  nextUpgradeCostMmk: number | null;
  nextUpgradeNameMm: string | null;
  fishPosition: number; // 0..100 position of the swimming fish on the tension bar
  barPosition: number; // 0..100 center of the player's green catch bar
  barHalfWidth: number; // half-width of the catch zone based on rodLevel
  reelProgress: number; // 0..100% progress to land the fish
  totalCaught: number;
  totalSoldCount: number;
  totalEarnedMmk: number;
  biggestKg: number;
  lastCatch: FishCatchInfo | null;
  fishBasket: FishCatchInfo[]; // Unsold fish in basket waiting to be sold at Fish Shop!
  basketValueMmk: number;
  caughtSpecies: string[];
  messageMm: string;
}

export interface HUDState {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  stamina: number;
  jadeCount: number; // Represents Myanmar Kyat (MMK) Balance!
  totalJadeInWorld: number;
  score: number;
  meritLevel: number;
  currentRegion: LandmarkInfo;
  activeVehicle: VehicleType;
  nearVehicle: { id: string; type: VehicleType; label: string; dist: number } | null;
  nearInteractable: { id: string; labelMm: string; labelEn: string } | null;
  speedKmh: number;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  cameraYaw: number;
  waypointX: number;
  waypointZ: number;
  waypointLabelMm: string;
  quests: QuestObjective[];
  activeQuestIndex: number;
  enemiesRemaining: number;
  totemsActivated: number;
  timeOfDay: TimeOfDay;
  weather: WeatherMode;
  activeChallenge: ActiveChallengeState | null;
  cameraMode: CameraMode;
  isMuted: boolean;
  notification: { title: string; subtitle: string; timestamp: number } | null;
  minimapEntities: MinimapEntity[];
  comboCount: number;
  isManauDancing: boolean;
  manauRhythm: ManauRhythmState;
  fishing: FishingMiniGameState;
  musicTrack: 'off' | 'sample1' | 'sample2' | 'custom';
  musicTrackLabel: string;
  hasCustomSong: boolean;
  osm3d: Osm3DStats;
  activeNpcDialogue: {
    npc: InteractiveNpcInfo;
    currentReplyMm: string;
  } | null;
}

export type NpcRole = 'shopkeeper' | 'quest_giver' | 'citizen';

export interface NpcTradeItem {
  id: string;
  nameMm: string;
  nameEn: string;
  priceMmk: number;
  effectType: 'heal_full' | 'max_hp_boost' | 'stamina_boost' | 'sell_all_fish';
  descriptionMm: string;
}

export interface NpcDialogueOption {
  id: string;
  labelMm: string;
  responseMm: string;
  actionType?: 'set_gps' | 'claim_reward' | 'open_shop' | 'close';
  targetX?: number;
  targetZ?: number;
  targetLabelMm?: string;
  rewardMmk?: number;
}

export interface InteractiveNpcInfo {
  id: string;
  nameMm: string;
  nameEn: string;
  role: NpcRole;
  roleLabelMm: string;
  locationMm: string;
  x: number;
  z: number;
  accentColor: string;
  greetingMm: string;
  dialogueOptions: NpcDialogueOption[];
  tradeItems?: NpcTradeItem[];
}

export interface OsmNamedPlace {
  id: string;
  nameMm: string;
  nameEn: string;
  category: string;
  x: number;
  z: number;
  lat: number;
  lng: number;
}

export interface OsmRoadPolyline {
  id: string;
  name: string;
  highway: string;
  points: { x: number; z: number }[];
}

export interface OsmBuildingFootprint {
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
}

export interface OsmCitySpawnPoint {
  id: string;
  nameMm: string;
  nameEn: string;
  x: number;
  z: number;
  heading: number;
  lat: number;
  lng: number;
  buildingsNearby: number;
}

export interface Osm3DStats {
  loaded: boolean;
  visible: boolean;
  debugMode: boolean;
  sourceName: string;
  buildingsCount: number;
  roadsCount: number;
  nearbyBuildings150m: number;
  nearestRoadName: string;
  nearestRoadDistM: number;
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
}

// ============================================================================
// 1:1 MYITKYINA PROJECTION — world units are meters (+x east, +z south)
// Origin (0, 0) = Manau plaza. Play area: 3 km × 3 km of real downtown Myitkyina,
// generated from OpenStreetMap by scripts/build-map-data.mjs.
// ============================================================================
export const MYITKYINA_GEO_ORIGIN = {
  lat: MAP_ORIGIN.lat,
  lng: MAP_ORIGIN.lng,
  zPerLat: -METERS_PER_DEG_LAT,
  xPerLng: METERS_PER_DEG_LNG,
};

export function osmLatLngToWorld(lat: number, lng: number): { x: number; z: number } {
  return {
    x: (lng - MYITKYINA_GEO_ORIGIN.lng) * MYITKYINA_GEO_ORIGIN.xPerLng,
    z: (lat - MYITKYINA_GEO_ORIGIN.lat) * MYITKYINA_GEO_ORIGIN.zPerLat,
  };
}

export function latLngToWorld(lat: number, lng: number): { x: number; z: number } {
  const p = osmLatLngToWorld(lat, lng);
  return { x: Math.round(p.x), z: Math.round(p.z) };
}

export function worldToLatLng(x: number, z: number): { lat: number; lng: number } {
  return {
    lat: Number((MYITKYINA_GEO_ORIGIN.lat + z / MYITKYINA_GEO_ORIGIN.zPerLat).toFixed(6)),
    lng: Number((MYITKYINA_GEO_ORIGIN.lng + x / MYITKYINA_GEO_ORIGIN.xPerLng).toFixed(6)),
  };
}

function namedPlace(name: string): { x: number; z: number } {
  const p = OSM_NAMED_PLACES.find((n) => n.name === name);
  if (!p) throw new Error(`OSM place not found: ${name}`);
  return { x: p.x, z: p.z };
}

/** West-bank riverside point at world z (offset meters inland from the water's edge). */
function riverBankAt(z: number, inland: number): { x: number; z: number } {
  let a = RIVER_POINTS[0];
  let b = RIVER_POINTS[RIVER_POINTS.length - 1];
  for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
    if (z >= RIVER_POINTS[i].z && z <= RIVER_POINTS[i + 1].z) {
      a = RIVER_POINTS[i];
      b = RIVER_POINTS[i + 1];
      break;
    }
  }
  const t = b.z === a.z ? 0 : (z - a.z) / (b.z - a.z);
  const cx = a.cx + (b.cx - a.cx) * t;
  const hw = a.hw + (b.hw - a.hw) * t;
  return { x: Math.round(cx - hw - inland), z };
}

/** Key real-world places inside the play area (world meters). */
export const MAP_PLACES = {
  railwayStation: namedPlace('Myitkyina Railway Station'),
  cityHall: namedPlace('City Hall'),
  ramjankiTemple: namedPlace('Shree Ramjanki Temple'),
  kachinBaptist: namedPlace('Kachin Su Biblical Baptish Church'),
  kbcHeadquarters: namedPlace('မြစ်ကြီးနားဇုံနယ် ကချင်နှစ်ခြင်း အသင်းချုပ်'),
  wunthoMonastery: namedPlace('ဝန်းသိုကျောင်းတိုက်'),
  /** City center (25.3833°N, 97.3964°E) — Myoma market area */
  downtown: latLngToWorld(25.3833, 97.3964),
  pagodaJetty: riverBankAt(-150, 40),
  strandNorth: riverBankAt(-800, 35),
  strandSouth: riverBankAt(350, 35),
};

// Verified Collision-Safe Drivable OSM Road Spawn Points inside the Dense Myitkyina OSM City Clusters
function makeSpawn(
  id: string,
  nameMm: string,
  nameEn: string,
  near: { x: number; z: number },
  buildingsNearby: number,
): OsmCitySpawnPoint {
  const p = roadsidePoint(near.x, near.z, 0, true);
  const ll = worldToLatLng(p.x, p.z);
  // Sum 50 m density cells whose centers are within 150 m
  let counted = 0;
  const D = BUILDING_DENSITY;
  for (let j = 0; j < D.rows; j++) {
    for (let i = 0; i < D.cols; i++) {
      const cx = D.minX + (i + 0.5) * D.cell;
      const cz = D.minZ + (j + 0.5) * D.cell;
      if (Math.hypot(cx - p.x, cz - p.z) <= 150) counted += D.counts[j * D.cols + i];
    }
  }
  return {
    id,
    nameMm,
    nameEn,
    x: p.x,
    z: p.z,
    heading: p.heading,
    lat: ll.lat,
    lng: ll.lng,
    buildingsNearby: buildingsNearby || counted,
  };
}

export const DEFAULT_OSM_CITY_SPAWNS: OsmCitySpawnPoint[] = [
  makeSpawn(
    'city_railway_station',
    'မြစ်ကြီးနား မီးရထားဘူတာ',
    'Myitkyina Railway Station',
    MAP_PLACES.railwayStation,
    0,
  ),
  makeSpawn('city_downtown', 'မြို့လယ် / မြို့မဈေး', 'Downtown Myoma Market', MAP_PLACES.downtown, 0),
  makeSpawn('city_hall', 'မြို့တော်ခန်းမ', 'City Hall', MAP_PLACES.cityHall, 0),
  makeSpawn(
    'city_kachin_baptist',
    'ကချင်နှစ်ခြင်း အသင်းချုပ် ရပ်ကွက်',
    'Kachin Baptist Convention Quarter',
    MAP_PLACES.kbcHeadquarters,
    0,
  ),
  makeSpawn('city_strand_road', 'ကမ်းနားလမ်း (ဧရာဝတီ)', 'Strand Road Riverside', MAP_PLACES.strandNorth, 0),
];

// ============================================================================
// INTERACTIVE NPC SYSTEM (SHOPKEEPERS, QUEST GIVERS & REGULAR CITIZENS)
// ============================================================================
const LEGACY_NPCS: InteractiveNpcInfo[] = [
  {
    id: 'npc_elder_zau_ring',
    nameMm: 'ဒူဝါဇော်ရိန် (Duwa Zau Ring)',
    nameEn: 'Duwa Zau Ring — Manau Elder & Quest Giver',
    role: 'quest_giver',
    roleLabelMm: '📜 မစ်ရှင်ပေးသူ ရပ်မိရပ်ဖ (Quest Giver)',
    locationMm: 'စီတာပူ မနောကွင်း အဝင်ဂိတ်အနီး (x: -10, z: 28)',
    x: -10,
    z: 28,
    accentColor: '#f59e0b',
    greetingMm:
      'မင်္ဂလာပါ လူငယ်လေး! စီတာပူ မနောကွင်းကနေ တောင်ဘက် ပြည်ထောင်စုလမ်းမကြီးနဲ့ ကချင်စုရပ်ကွက်ဘက်မှာ မြစ်ကြီးနား OpenStreetMap 3D မြို့ပြအဆောက်အအုံ (၁,၁၂၃) လုံးနဲ့ လမ်း (၂,၈၂၁) သွယ် တည်ရှိပါတယ်။ ဘယ်မစ်ရှင်ကို လမ်းညွှန်ပေးရမလဲ?',
    dialogueOptions: [
      {
        id: 'opt_inspect_city',
        labelMm: '🏙️ OSM မြို့လယ် (ကချင်စု/ဆမားလမ်း) သို့ GPS လမ်းညွှန်ပေးပါ',
        responseMm:
          'ကချင်စု နှစ်ခြင်းဘုရားကျောင်းနဲ့ ဆမားဘုံကျောင်းအနီး OSM 3D မြို့လယ်သို့ GPS မှတ်ပေးလိုက်ပါပြီ! အပေါ်ဘားက [🏙️ မြို့လယ်သို့သွားမည်] ခလုတ်နှိပ်၍လည်း တိုက်ရိုက်သွားနိုင်ပါတယ်။',
        actionType: 'set_gps',
        targetX: -18,
        targetZ: 552,
        targetLabelMm: 'ကချင်စု OSM 3D မြို့လယ်ရပ်ကွက်',
      },
      {
        id: 'opt_fishing_job',
        labelMm: '🎣 ငွေရှာရန် ဗလမင်းထင်တံတား ငါးမျှားစခန်း ညွှန်ပေးပါ',
        responseMm:
          'ဗလမင်းထင်တံတားအောက် ငါးမျှားစခန်းမှာ ဧရာဝတီ ငါးတန်ကြီးတွေ ပေါတယ်! အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ဝယ်ပြီး ဖမ်းမိတဲ့ငါးကို ငါးအဝယ်ဒိုင်မှာ ပြန်ရောင်းပါ။',
        actionType: 'set_gps',
        targetX: 142,
        targetZ: -344,
        targetLabelMm: 'ဗလမင်းထင်တံတားအောက် ငါးမျှားစခန်း',
      },
      {
        id: 'opt_blessing_reward',
        labelMm: '🙏 မနောပွဲတော် ကောင်းချီးမင်္ဂလာ ထောက်ပံ့ငွေ ရယူမည် (+15,000 MMK)',
        responseMm:
          'ကချင်ရိုးရာ ယဉ်ကျေးမှုကို ထိန်းသိမ်းတဲ့အတွက် ဂုဏ်ပြုချီးမြှင့်ငွေ 15,000 MMK ပေးအပ်ပါတယ်!',
        actionType: 'claim_reward',
        rewardMmk: 15000,
      },
    ],
  },
  {
    id: 'npc_shopkeeper_bawk_nu',
    nameMm: 'ဒေါ်ဘောက်နူး (Daw Bawk Nu)',
    nameEn: 'Daw Bawk Nu — Kachin Traditional Shopkeeper',
    role: 'shopkeeper',
    roleLabelMm: '🛒 ရိုးရာစားသောက်ဆိုင်နှင့် ရိက္ခာဆိုင်ရှင် (Shopkeeper)',
    locationMm: 'စီတာပူ လုံဂါပါဆိုင်အနီး (x: -54, z: 48)',
    x: -54,
    z: 48,
    accentColor: '#10b981',
    greetingMm:
      'လာပါရှင်! ဒေါ်ဘောက်နူးရဲ့ ကချင်ရိုးရာ စားဖွယ်စုံနဲ့ ငါးမျှား/ခရီးသွား ရိက္ခာဆိုင်ကနေ ကြိုဆိုပါတယ်။ ဖမ်းမိလာတဲ့ ငါးတွေလည်း ဒီမှာတင် ရောင်းလို့ရသလို အားဖြည့်စာတွေလည်း ဝယ်ယူနိုင်ပါတယ်ရှင်။',
    dialogueOptions: [
      {
        id: 'opt_delivery_info',
        labelMm: '🛵 ကချင်ထမင်းဟင်း ပို့ဆောင်ရေးအလုပ် ဘယ်လိုလုပ်ရမလဲ?',
        responseMm:
          'အပေါ်ဘားက [📦 မုန့်ပို့ (+35k)] ခလုတ်ကိုနှိပ်ပြီး ဘက်ထရီဆိုင်ကယ်နဲ့ ၃ နေရာ ပို့ပေးရင် 35,000 MMK ချက်ချင်းရပါတယ်ရှင်!',
      },
    ],
    tradeItems: [
      {
        id: 'item_shat_jam',
        nameMm: '🍛 ကချင်ထမင်းနယ်နှင့် ကြက်ကချင်ချက် (Shat Jam)',
        nameEn: 'Kachin Shat Jam Feast',
        priceMmk: 5000,
        effectType: 'heal_full',
        descriptionMm: 'HP 100% နှင့် Stamina 100% အပြည့် ပြန်ဖြည့်ပေးသည်',
      },
      {
        id: 'item_herbal_tea',
        nameMm: '🍵 ခါကာဘိုရာဇီ တောင်ပေါ်ဆေးဖက်ဝင် လက်ဖက်ရည်',
        nameEn: 'Highland Cordyceps Herbal Tonic',
        priceMmk: 12000,
        effectType: 'max_hp_boost',
        descriptionMm: 'အမြင့်ဆုံးအသက် (Max HP +20) အမြဲတမ်း တိုးပေးသည်',
      },
      {
        id: 'item_sell_fish',
        nameMm: '🐟 ပလိုင်းထဲရှိ ဖမ်းမိသောငါးအားလုံး ရောင်းချမည်',
        nameEn: 'Sell All Caught Fish in Basket',
        priceMmk: 0,
        effectType: 'sell_all_fish',
        descriptionMm: 'ငါးပလိုင်းထဲရှိ ငါးများကို ဈေးကွက်ပေါက်ဈေးအတိုင်း MMK ဖြင့် ရောင်းမည်',
      },
    ],
  },
  {
    id: 'npc_quest_roi_ji',
    nameMm: 'ဆရာမ ရွယ်ဂျီ (Sayama Roi Ji)',
    nameEn: 'Sayama Roi Ji — OSM City Center Coordinator',
    role: 'quest_giver',
    roleLabelMm: '📜 မြို့ပြစီမံကိန်းနှင့် မစ်ရှင်တာဝန်ခံ (Quest Giver)',
    locationMm: 'ကချင်စု OSM 3D မြို့လယ်လမ်းဆုံ (x: -22, z: 548)',
    x: -22,
    z: 548,
    accentColor: '#38bdf8',
    greetingMm:
      'ကချင်စုနဲ့ ဆမားလမ်း OpenStreetMap 3D မြို့လယ်ဇုန်သို့ ရောက်ရှိလာတာ ကြိုဆိုပါတယ်! ဒီပတ်ဝန်းကျင်မှာ ဘုရားကျောင်းကြီးများ၊ စာသင်ကျောင်းများနဲ့ လူနေအိမ်ခြေ (၂၀၀) ကျော်ကို OpenStreetMap ဒေတာအစစ်မှ 3D ပြောင်းလဲထားပါတယ်။',
    dialogueOptions: [
      {
        id: 'opt_city_survey_reward',
        labelMm: '🏆 OSM 3D မြို့လယ် ကွင်းဆင်းလေ့လာမှု ဆုကြေးယူမည် (+25,000 MMK)',
        responseMm:
          'မြစ်ကြီးနား OpenStreetMap 3D မြို့လယ်သို့ ကိုယ်တိုင်လာရောက် ကွင်းဆင်းလေ့လာတဲ့အတွက် ဆုကြေး 25,000 MMK ချီးမြှင့်ပါတယ်!',
        actionType: 'claim_reward',
        rewardMmk: 25000,
      },
      {
        id: 'opt_goto_station',
        labelMm: '🚂 မြစ်ကြီးနား မီးရထားဘူတာရုံကြီး (OSM) သို့ လမ်းညွှန်ပေးပါ',
        responseMm:
          'မြစ်ကြီးနား မီးရထားဘူတာရုံကြီး (x: -114, z: 387) သို့ GPS လမ်းညွှန် မှတ်သားပေးလိုက်ပါပြီ!',
        actionType: 'set_gps',
        targetX: -114,
        targetZ: 387,
        targetLabelMm: 'မြစ်ကြီးနား မီးရထားဘူတာ (Myitkyina Railway Station)',
      },
    ],
  },
  {
    id: 'npc_shop_lahtaw_gam',
    nameMm: 'ဦးလထော်ဂမ် (U Lahtaw Gam)',
    nameEn: 'U Lahtaw Gam — City Hall Trader & Fish Merchant',
    role: 'shopkeeper',
    roleLabelMm: '🛒 မြို့တော်ခန်းမ ကုန်သည်နှင့် ငါးဒိုင် (Shopkeeper)',
    locationMm: 'မြို့တော်ခန်းမ (City Hall OSM) လမ်းမကြီးဘေး (x: -98, z: 186)',
    x: -98,
    z: 186,
    accentColor: '#facc15',
    greetingMm:
      'မြစ်ကြီးနား မြို့တော်ခန်းမ (City Hall) ရှေ့ ကုန်သွယ်ရေးစခန်းက ကြိုဆိုပါတယ်! ဧရာဝတီမြစ်က ဖမ်းမိလာတဲ့ ငါးတွေကို ဒီမှာ ဈေးကောင်းပေးဝယ်သလို အားဖြည့်ကော်ဖီနဲ့ ရိုးရာအစားအစာတွေလည်း ရောင်းပေးနေပါတယ်။',
    dialogueOptions: [
      {
        id: 'opt_city_hall_lore',
        labelMm: '🏛️ မြို့တော်ခန်းမနှင့် ပြည်ထောင်စုလမ်းမကြီးအကြောင်း ပြောပြပါ',
        responseMm:
          'ဒီနေရာဟာ OpenStreetMap ထဲက City Hall (25.3921°N, 97.3997°E) အဆောက်အအုံအစစ် တည်ရှိရာ ပြည်ထောင်စုလမ်းမကြီး ဖြစ်ပါတယ်။ မြောက်ဘက်သွားရင် စီတာပူ မနောကွင်း၊ တောင်ဘက်သွားရင် ဘူတာရုံနဲ့ ကချင်စုကို ရောက်ပါတယ်။',
      },
    ],
    tradeItems: [
      {
        id: 'item_myitkyina_coffee',
        nameMm: '☕ မြစ်ကြီးနား တောင်ပေါ်ကော်ဖီပူပူ (Highland Espresso)',
        nameEn: 'Myitkyina Highland Coffee',
        priceMmk: 4000,
        effectType: 'heal_full',
        descriptionMm: 'HP နှင့် Stamina အပြည့် ပြန်လည်ဖြည့်တင်းပေးသည်',
      },
      {
        id: 'item_vitality_tonic',
        nameMm: '🍯 ကချင်တောပျားရည်နှင့် ဂျင်ဆင်းအားဆေး',
        nameEn: 'Wild Kachin Honey & Ginseng',
        priceMmk: 12000,
        effectType: 'max_hp_boost',
        descriptionMm: 'Max HP +20 အမြဲတမ်း တိုးမြှင့်ပေးသည်',
      },
      {
        id: 'item_sell_fish_city',
        nameMm: '🐟 ပလိုင်းထဲရှိ ငါးအားလုံး ရောင်းချမည် (Cash MMK)',
        nameEn: 'Sell All Caught Fish for MMK',
        priceMmk: 0,
        effectType: 'sell_all_fish',
        descriptionMm: 'ဖမ်းမိထားသော ငါးအားလုံးကို မြို့လယ်ပေါက်ဈေးဖြင့် ရောင်းချမည်',
      },
    ],
  },
  {
    id: 'npc_citizen_naw_aung',
    nameMm: 'မောင်နော်အောင် (Maung Naw Aung)',
    nameEn: 'Maung Naw Aung — Railway Quarter Citizen',
    role: 'citizen',
    roleLabelMm: '💬 ဘူတာရုံရပ်ကွက် မြို့ခံပြည်သူ (Regular Citizen)',
    locationMm: 'မြစ်ကြီးနား ဘူတာရုံကြီး (OSM) အနီး (x: -84, z: 384)',
    x: -84,
    z: 384,
    accentColor: '#a855f7',
    greetingMm:
      'ဟေး မိတ်ဆွေ! မြစ်ကြီးနား ဘူတာရုံကြီးနဲ့ Shree Ramjanki ဘုရားကျောင်းလမ်းဆုံက ကြိုဆိုပါတယ်။ AIMA ဘက်ထရီဆိုင်ကယ်စီးရင်း သီချင်းဖွင့်ပြီး မြို့ပတ်ရတာ အရမ်းမိုက်တယ်နော်!',
    dialogueOptions: [
      {
        id: 'opt_fishing_secret',
        labelMm: '🐟 ဘယ်နေရာမှာ ငါးအကြီးဆုံး ဖမ်းလို့ရသလဲ?',
        responseMm:
          'ဗလမင်းထင်တံတားအောက် (x: 142, z: -344) နဲ့ မြစ်ဆုံ (x: 158, z: -532) မှာ ငါးမျှားတံ Lv.2 / Lv.3 အဆင့်မြှင့်ပြီး မျှားရင် တစ်ကောင်ကို 50,000 MMK ကျော်တန်တဲ့ ဧရာဝတီ ရွှေငါးတန်ဘုရင်ကြီးတွေ မိနိုင်တယ်ဗျ!',
      },
      {
        id: 'opt_southeast_town',
        labelMm: '🏘️ အဆောက်အအုံ အထူထပ်ဆုံး OSM ရပ်ကွက်က ဘယ်မှာလဲ?',
        responseMm:
          'အရှေ့တောင်ဘက် သစ်တောဦးစီးဌာနနဲ့ ဘူးဂါးလျှပ်စစ်ရုံး ရပ်ကွက် (x: 499, z: 871) မှာ OpenStreetMap အိမ်ခြေ (၅၇၀) ကျော် တစုတဝေးတည်း ရှိတယ်! GPS မှတ်ပေးလိုက်မယ်နော်။',
        actionType: 'set_gps',
        targetX: 499,
        targetZ: 871,
        targetLabelMm: 'သစ်တောဦးစီးဌာန / ဘူးဂါး OSM မြို့ကွက်သစ် (570+ Buildings)',
      },
    ],
  },
  {
    id: 'npc_citizen_seng_pan',
    nameMm: 'နန်းဆိုင်ပန် (Nang Seng Pan)',
    nameEn: 'Nang Seng Pan — Myitkyina University Student',
    role: 'citizen',
    roleLabelMm: '💬 မြစ်ကြီးနားတက္ကသိုလ် ကျောင်းသူ (Regular Citizen)',
    locationMm: 'မြစ်ကြီးနားတက္ကသိုလ် ဘွဲ့နှင်းသဘင်ရှေ့ (x: -32, z: -268)',
    x: -32,
    z: -268,
    accentColor: '#ec4899',
    greetingMm:
      'မင်္ဂလာပါရှင်! မြစ်ကြီးနားတက္ကသိုလ် ပရိဝုဏ်နဲ့ အနောက်ဘက် ကောလိပ်ကျောင်းဝန်း (College Building & St. Luke Church) တွေကိုလည်း OpenStreetMap 3D မြေပုံပေါ်မှာ လေ့လာနိုင်ပါတယ်။',
    dialogueOptions: [
      {
        id: 'opt_college_gps',
        labelMm: '🏫 အနောက်ဘက် College Building & St. Luke ဘုရားကျောင်းသို့ ညွှန်ပေးပါ',
        responseMm:
          'အနောက်ဘက် OSM Campus (x: -502, z: -112) သို့ GPS မှတ်ပေးလိုက်ပါပြီရှင်!',
        actionType: 'set_gps',
        targetX: -502,
        targetZ: -112,
        targetLabelMm: "College Building & St. Luke's Church (OSM)",
      },
      {
        id: 'opt_manau_tip',
        labelMm: '💃 မနောအက သံစဉ်မစ်ရှင်အကြောင်း ပြောပြပါ',
        responseMm:
          'စီတာပူ မနောကွင်းအလယ်မှာ [💃 မနောအက] ခလုတ်နှိပ်ပြီး ရိုးရာတေးသံစဉ် စည်းချက်အလိုက် (◀/▲/▼/▶) ၈ ချက် မှန်အောင်နှိပ်ရင် ဆုကြေး 35,000 MMK ရပါတယ်ရှင်!',
      },
    ],
  },
];

/** Where each NPC stands in the 1:1 map, and dialogue that points at real in-area places. */
const NPC_PLACEMENT: Record<
  string,
  { at: { x: number; z: number }; exact?: boolean; locationMm: string; roleLabelMm?: string; greetingMm?: string }
> = {
  npc_elder_zau_ring: { at: { x: -12, z: 52 }, exact: true, locationMm: 'မနောကွင်း တောင်ဘက် အဝင်ဂိတ်အနီး' },
  npc_shopkeeper_bawk_nu: { at: { x: -70, z: 70 }, locationMm: 'လုံဂါပါ ကချင်ရိုးရာဆိုင်ရှေ့' },
  npc_quest_roi_ji: { at: MAP_PLACES.downtown, locationMm: 'မြို့လယ် မြို့မဈေးလမ်း' },
  npc_shop_lahtaw_gam: { at: MAP_PLACES.cityHall, locationMm: 'မြို့တော်ခန်းမ လမ်းမကြီးဘေး' },
  npc_citizen_naw_aung: { at: MAP_PLACES.railwayStation, locationMm: 'မြစ်ကြီးနား မီးရထားဘူတာ အနီး' },
  npc_citizen_seng_pan: {
    at: MAP_PLACES.ramjankiTemple,
    locationMm: 'ရာမဇာနကီ ဟိန္ဒူဘုရားကျောင်း လမ်းဘေး',
    roleLabelMm: '💬 မြစ်ကြီးနား ကျောင်းသူ (Regular Citizen)',
    greetingMm:
      'မင်္ဂလာပါရှင်! ဒီမြို့လယ်မှာ ဟိန္ဒူဘုရားကျောင်း၊ ဘုန်းကြီးကျောင်း၊ ခရစ်ယာန်ဘုရားကျောင်းတွေ လမ်းလျှောက်ရုံနဲ့ ရောက်တယ်ရှင်။',
  },
};

const OPTION_OVERRIDES: Record<string, Partial<NpcDialogueOption>> = {
  opt_inspect_city: {
    labelMm: '🏙️ မြို့လယ် မြို့မဈေးဘက်သို့ GPS လမ်းညွှန်ပေးပါ',
    responseMm: 'မြို့မဈေးနဲ့ မြို့လယ်လမ်းတွေဆီ GPS မှတ်ပေးလိုက်ပြီ။ ဘူတာရုံကနေ မြောက်ဘက် လမ်းလျှောက်ရုံပဲ!',
    targetX: MAP_PLACES.downtown.x,
    targetZ: MAP_PLACES.downtown.z,
    targetLabelMm: 'မြို့မဈေး / မြို့လယ်',
  },
  opt_fishing_job: {
    labelMm: '🎣 ငွေရှာရန် ဧရာဝတီ ကမ်းနား ငါးမျှားဆိပ် ညွှန်ပေးပါ',
    responseMm:
      'ဆုတောင်းပြည့်စေတီ ကမ်းနား ငါးမျှားဆိပ်မှာ ဧရာဝတီ ငါးတွေ ပေါတယ်! ငါးဆိုင်မှာ ဝါးငါးမျှားတံ (30,000 MMK) အရင်ဝယ်ပါ။',
    targetX: MAP_PLACES.pagodaJetty.x,
    targetZ: MAP_PLACES.pagodaJetty.z,
    targetLabelMm: 'ဆုတောင်းပြည့်စေတီ ကမ်းနား ငါးမျှားဆိပ်',
  },
  opt_goto_station: {
    responseMm: 'မြစ်ကြီးနား မီးရထားဘူတာ (မန္တလေး–မြစ်ကြီးနား ရထားလမ်း အဆုံး) သို့ GPS လမ်းညွှန် မှတ်ပေးလိုက်ပါပြီ!',
    targetX: MAP_PLACES.railwayStation.x,
    targetZ: MAP_PLACES.railwayStation.z,
  },
  opt_fishing_secret: {
    responseMm:
      'ကမ်းနားလမ်း မြောက်ပိုင်း ငါးမျှားဆိပ်မှာ ငါးမျှားတံ Lv.2 / Lv.3 နဲ့ မျှားရင် တစ်ကောင် 50,000 MMK ကျော်တန်တဲ့ ငါးကြီးတွေ မိနိုင်တယ်ဗျ!',
  },
  opt_southeast_town: {
    labelMm: '⛪ ကချင်နှစ်ခြင်း အသင်းချုပ် ရပ်ကွက်က ဘယ်မှာလဲ?',
    responseMm: 'မြို့တောင်ပိုင်းမှာ ကချင်နှစ်ခြင်း အသင်းချုပ်နဲ့ ဘုရားကျောင်းတွေ စုနေတယ်။ GPS မှတ်ပေးလိုက်မယ်နော်။',
    targetX: MAP_PLACES.kbcHeadquarters.x,
    targetZ: MAP_PLACES.kbcHeadquarters.z,
    targetLabelMm: 'ကချင်နှစ်ခြင်း အသင်းချုပ်',
  },
  opt_college_gps: {
    labelMm: '🛕 ဝန်းသို ဘုန်းကြီးကျောင်းတိုက်သို့ ညွှန်ပေးပါ',
    responseMm: 'ဝန်းသို ကျောင်းတိုက်ဆီ GPS မှတ်ပေးလိုက်ပါပြီရှင်!',
    targetX: MAP_PLACES.wunthoMonastery.x,
    targetZ: MAP_PLACES.wunthoMonastery.z,
    targetLabelMm: 'ဝန်းသို ကျောင်းတိုက်',
  },
};

export const MYITKYINA_INTERACTIVE_NPCS: InteractiveNpcInfo[] = LEGACY_NPCS.map((npc) => {
  const place = NPC_PLACEMENT[npc.id];
  const at = !place ? { x: npc.x, z: npc.z } : place.exact ? place.at : roadsidePoint(place.at.x, place.at.z, 3);
  return {
    ...npc,
    ...(place ? { locationMm: place.locationMm } : {}),
    ...(place?.roleLabelMm ? { roleLabelMm: place.roleLabelMm } : {}),
    ...(place?.greetingMm ? { greetingMm: place.greetingMm } : {}),
    x: at.x,
    z: at.z,
    dialogueOptions: npc.dialogueOptions.map((o) => ({ ...o, ...(OPTION_OVERRIDES[o.id] || {}) })),
  };
});

function makeLandmark(
  id: RegionId,
  nameMm: string,
  nameEn: string,
  quarterMm: string,
  subtitle: string,
  lat: number,
  lng: number,
  radius: number,
  color: string,
): LandmarkInfo {
  const { x, z } = latLngToWorld(lat, lng);
  return { id, nameMm, nameEn, quarterMm, subtitle, x, z, lat, lng, radius, color };
}

function makeLandmarkAt(
  id: RegionId,
  nameMm: string,
  nameEn: string,
  quarterMm: string,
  subtitle: string,
  at: { x: number; z: number },
  radius: number,
  color: string,
): LandmarkInfo {
  const ll = worldToLatLng(at.x, at.z);
  return makeLandmark(id, nameMm, nameEn, quarterMm, subtitle, ll.lat, ll.lng, radius, color);
}

export const MYITKYINA_LANDMARKS: LandmarkInfo[] = [
  makeLandmarkAt(
    'manau_park',
    'မနောကွင်း',
    'Kachin Manau Grounds',
    'မြို့လယ် ဘူတာရုံအနီး',
    'Manau Festival Grounds & Totems',
    { x: 0, z: 0 },
    70,
    '#DC2626',
  ),
  makeLandmarkAt(
    'railway_station',
    'မြစ်ကြီးနား မီးရထားဘူတာ',
    'Myitkyina Railway Station',
    'မြို့လယ်',
    'Northern terminus of the Mandalay–Myitkyina railway',
    MAP_PLACES.railwayStation,
    70,
    '#3B82F6',
  ),
  makeLandmarkAt(
    'downtown_market',
    'မြို့မဈေး / မြို့လယ်',
    'Myoma Market & Downtown',
    'မြို့လယ်',
    'Central market streets',
    MAP_PLACES.downtown,
    110,
    '#F59E0B',
  ),
  makeLandmarkAt(
    'pagoda_riverfront',
    'ဆုတောင်းပြည့်စေတီ မြစ်ကမ်းနား',
    'Sutaungpyae Pagoda Riverfront',
    'ဧရာဝတီ ကမ်းနား',
    'Riverside stupa & boat jetty',
    MAP_PLACES.pagodaJetty,
    90,
    '#FBBF24',
  ),
  makeLandmarkAt(
    'strand_road',
    'ကမ်းနားလမ်း (ဧရာဝတီ)',
    'Strand Road Riverside',
    'ဧရာဝတီ အနောက်ကမ်း မြောက်ပိုင်း',
    'Ayeyarwady riverbank promenade',
    MAP_PLACES.strandNorth,
    110,
    '#38BDF8',
  ),
  makeLandmarkAt(
    'kachin_baptist',
    'ကချင်နှစ်ခြင်း အသင်းချုပ်',
    'Kachin Baptist Convention',
    'မြို့တောင်ပိုင်း',
    'KBC headquarters & churches',
    MAP_PLACES.kbcHeadquarters,
    110,
    '#A855F7',
  ),
];

function makeBuilding(
  id: string,
  nameMm: string,
  nameEn: string,
  quarterMm: string,
  category: FamousBuildingInfo['category'],
  lat: number,
  lng: number,
  worldX: number,
  worldZ: number,
  width: number,
  depth: number,
  height: number,
  roofShape: FamousBuildingInfo['roofShape'],
  color: string,
  accentColor: string,
  interactPromptMm?: string,
  buffDescriptionMm?: string,
): FamousBuildingInfo {
  return {
    id,
    nameMm,
    nameEn,
    quarterMm,
    category,
    x: worldX,
    z: worldZ,
    lat,
    lng,
    width,
    depth,
    height,
    roofShape,
    color,
    accentColor,
    interactPromptMm,
    buffDescriptionMm,
  };
}

// Spaciously Distributed Sitapu Quarter & Northern Myitkyina Landmarks, Hotels, Cafes & Cultural Sites
// Every building is set back 15m-25m beside its adjacent road segment so buildings and roads NEVER overlap!
const LEGACY_FAMOUS_BUILDINGS: FamousBuildingInfo[] = [
  makeBuilding(
    'bldg_palm_spring',
    'Palm Spring Resort Hotel (စီတာပူ)',
    'Palm Spring Resort (Sitapu Ward 7/8)',
    '(7/8) စီတာပူရပ်ကွက် · ကွန်ကရစ်လမ်းမ မြောက်ဘက်ခြမ်း',
    'hotel',
    25.4068,
    97.4102,
    55,
    -122,
    20,
    15,
    9.0,
    'courtyard',
    '#0f766e',
    '#2dd4bf',
    'Palm Spring Resort တွင် အနားယူရန် [E] (HP & Stamina အပြည့်)',
    'Palm Spring Resort (စီတာပူ) တွင် အနားယူပြီး အားအင်အပြည့် ပြန်လည်ရရှိပါပြီ!',
  ),
  makeBuilding(
    'bldg_lung_ga_pa',
    'လုံဂါပါ ကချင်ရိုးရာစားသောက်ဆိုင် (စီတာပူ)',
    'Lung Ga Pa Kachin Traditional Restaurant',
    'စီတာပူ တောင်ဘက် မြေနီလမ်းသွယ် မြောက်ဘက်ခြမ်း',
    'restaurant',
    25.3985,
    97.4015,
    -62,
    42,
    16,
    11,
    6.2,
    'gable',
    '#7c2d12',
    '#f59e0b',
    'ကချင်ထမင်းနယ် (Shat Jam) နှင့် စာဖျော် စားသုံးရန် [E] (HP အပြည့်)',
    'Lung Ga Pa (စီတာပူ) တွင် ကချင်ရိုးရာအစားအစာ သုံးဆောင်ပြီး HP 100% ပြန်ပြည့်သွားပါပြီ!',
  ),
  makeBuilding(
    'bldg_fish_shop_sitapu',
    'ဧရာဝတီ ငါးအဝယ်ဒိုင် နှင့် ငါးမျှားပစ္စည်းဆိုင် (စီတာပူ)',
    'Sitapu Ayeyarwady Fish Shop & Tackle Store',
    'စီတာပူ အရှေ့ဘက် ဧရာဝတီမြစ်ကမ်းဘေး သဲလမ်းအနီး',
    'market',
    25.4025,
    97.4155,
    168,
    -24,
    18,
    10,
    5.8,
    'hipped',
    '#0284c7',
    '#fde047',
    '🐟 ဖမ်းမိသော ငါးများရောင်းရန် / ငါးမျှားတံ ဝယ်ယူအဆင့်မြှင့်ရန် [E]',
    'ဧရာဝတီ ငါးအဝယ်ဒိုင် နှင့် ငါးမျှားပစ္စည်းဆိုင်သို့ ရောက်ရှိပါပြီ!',
  ),
  makeBuilding(
    'bldg_fish_shop_bridge',
    'ဗလမင်းထင် တံတားအောက် ငါးအဝယ်ဒိုင် နှင့် ငါးမျှားဆိုင်',
    'Balaminhtin Bridge Fish Market & Gear Shop',
    'ဗလမင်းထင်တံတား အနောက်ဘက်ကမ်း ငါးမျှားဆိပ်အနီး',
    'market',
    25.4212,
    97.4132,
    122,
    -338,
    16,
    10,
    5.6,
    'gable',
    '#0369a1',
    '#38bdf8',
    '🐟 ဖမ်းမိသော ငါးများရောင်းရန် / ငါးမျှားတံ ဝယ်ယူအဆင့်မြှင့်ရန် [E]',
    'ကမ်းနားလမ်း ငါးအဝယ်ဒိုင် နှင့် ငါးမျှားပစ္စည်းဆိုင်သို့ ရောက်ရှိပါပြီ!',
  ),
  makeBuilding(
    'bldg_sitapu_baptist',
    'စီတာပူ နှစ်ခြင်းခရစ်ယာန်ဘုရားကျောင်း',
    'Sitapu Kachin Baptist Church & Hall',
    'စီတာပူ အနောက်ဘက်ရပ်ကွက် · မြေနီလမ်းသွယ် မြောက်ဘက်ခြမ်း',
    'university',
    25.4045,
    97.3970,
    -162,
    -74,
    18,
    12,
    11.5,
    'gable',
    '#991b1b',
    '#f8fafc',
    'စီတာပူ ဘုရားကျောင်းဝန်း လေ့လာရန် [E] (HP အပြည့်)',
    'စီတာပူ ဘုရားကျောင်းဝန်းသို့ ရောက်ရှိလေ့လာခဲ့သည်!',
  ),
  makeBuilding(
    'bldg_sitapu_weaving',
    'စီတာပူ ကချင်ရိုးရာ ရက်ကန်းနှင့် လက်မှုစင်တာ',
    'Sitapu Traditional Kachin Weaving Center',
    'စီတာပူ အရှေ့တောင်ဘက် မြေနီလမ်းသွယ် တောင်ဘက်ခြမ်း',
    'shopping',
    25.3960,
    97.4085,
    45,
    138,
    16,
    11,
    6.5,
    'hipped',
    '#b45309',
    '#fde047',
    'ကချင်ရိုးရာ ရက်ကန်းစင်တာ လေ့လာရန် [E] (HP & Sprint Boost)',
    'စီတာပူ ရိုးရာဂျပ်ခုတ်ရက်ကန်းစင်တာမှ အားအင်အပြည့် ရရှိပါပြီ!',
  ),
  makeBuilding(
    'bldg_amber_palace',
    'Amber Palace Hotel (GD/8B စီတာပူ)',
    'Amber Palace Hotel Sitapu',
    'GD/8B စီတာပူ · ကချင်စု မြေနီလမ်းသွယ် မြောက်ဘက်ခြမ်း',
    'hotel',
    25.4105,
    97.3995,
    -85,
    -186,
    18,
    13,
    13.0,
    'modern_stepped',
    '#92400e',
    '#f59e0b',
    'Amber Palace Hotel တွင် အနားယူရန် [E] (HP 100%)',
    'Amber Palace Hotel (စီတာပူ) တွင် အနားယူပြီး HP အပြည့်ပြန်ဖြည့်ပြီး!',
  ),
  makeBuilding(
    'bldg_university_hall',
    'မြစ်ကြီးနားတက္ကသိုလ် ဘွဲ့နှင်းသဘင်ခန်းမကြီး',
    'Myitkyina University Convocation Hall',
    'တက္ကသိုလ်ရပ်ကွက် · တက္ကသိုလ် ကွန်ကရစ်လမ်းမ မြောက်ဘက်ခြမ်း',
    'university',
    25.4170,
    97.4025,
    -38,
    -292,
    26,
    15,
    11.5,
    'colonnade',
    '#1e40af',
    '#93c5fd',
    'မြစ်ကြီးနားတက္ကသိုလ် ဘွဲ့နှင်းသဘင် လေ့လာရန် [E] (HP အပြည့်)',
    'မြစ်ကြီးနားတက္ကသိုလ် ဘွဲ့နှင်းသဘင်ခန်းမသို့ ရောက်ရှိလေ့လာခဲ့သည်!',
  ),
  makeBuilding(
    'bldg_myitkyina_cafe',
    'Myitkyina Cafe & Garden (စီတာပူ တောင်ဘက်အဝင်)',
    'Myitkyina Cafe & Coffee Garden',
    'စီတာပူ ဗဟို ကွန်ကရစ်လမ်းမ အရှေ့ဘက်ခြမ်း',
    'cafe',
    25.3925,
    97.4045,
    24,
    162,
    15,
    11,
    6.5,
    'hipped',
    '#065f46',
    '#34d399',
    'Myitkyina Cafe ကော်ဖီသောက်ရန် [E] (HP & Stamina အပြည့်)',
    'Myitkyina Cafe တွင် ကော်ဖီသောက်ပြီး အားအင်အပြည့်ရရှိပါပြီ!',
  ),
  makeBuilding(
    'bldg_wun_tawp',
    'Wun Tawp Garden Hotel (ပြည်ထောင်စုလမ်းမကြီး)',
    'Wun Tawp Garden Hotel (438 Pyidaungsu Rd)',
    '၄၃၈ ပြည်ထောင်စုလမ်းမကြီး အရှေ့ဘက် · မြေမြင့်ရပ်ကွက်',
    'hotel',
    25.3910,
    97.3975,
    -85,
    216,
    17,
    12,
    9.8,
    'hipped',
    '#15803d',
    '#86efac',
    'Wun Tawp Garden Hotel တွင် အနားယူရန် [E] (HP & Stamina အပြည့်)',
    'Wun Tawp Garden Hotel တွင် အားအင်ပြန်ဖြည့်ပြီး!',
  ),
  makeBuilding(
    'bldg_hotel_myitkyina',
    'ဟိုတယ် မြစ်ကြီးနား (Hotel Myitkyina)',
    'Hotel Myitkyina (Strand Road Riverfront)',
    'ရာဇာဏာ / ကမ်းနားလမ်း အနောက်ဘက်ခြမ်း',
    'hotel',
    25.3895,
    97.4120,
    78,
    265,
    17,
    12,
    12.0,
    'modern_stepped',
    '#1e3a8a',
    '#fbbf24',
    'Hotel Myitkyina (ကမ်းနားလမ်း) တွင် အနားယူရန် [E] (HP 100%)',
    'ဧရာဝတီမြစ်ကမ်းဘေး Hotel Myitkyina တွင် အနားယူပြီး အားအင်ပြည့်ဝသွားပါပြီ!',
  ),
];

/**
 * Game buildings (shops, hotels, fish markets) placed on real empty plots beside real
 * streets near a chosen anchor, so they never overlap OpenStreetMap buildings.
 */
const FAMOUS_PLACEMENT: Record<
  string,
  { near: { x: number; z: number }; nameMm?: string; nameEn?: string; quarterMm?: string } | null
> = {
  bldg_lung_ga_pa: { near: { x: -70, z: 70 }, quarterMm: 'မနောကွင်း အနီး' },
  bldg_fish_shop_sitapu: {
    near: { x: MAP_PLACES.pagodaJetty.x - 30, z: MAP_PLACES.pagodaJetty.z + 40 },
    nameMm: 'ဧရာဝတီ ငါးအဝယ်ဒိုင် နှင့် ငါးမျှားပစ္စည်းဆိုင် (ကမ်းနား)',
    nameEn: 'Ayeyarwady Riverside Fish Shop & Tackle Store',
    quarterMm: 'ဆုတောင်းပြည့်စေတီ ကမ်းနား',
  },
  bldg_fish_shop_bridge: {
    near: { x: MAP_PLACES.strandNorth.x - 30, z: MAP_PLACES.strandNorth.z },
    nameMm: 'ကမ်းနားလမ်း ငါးအဝယ်ဒိုင် နှင့် ငါးမျှားဆိုင်',
    nameEn: 'Strand Road Fish Market & Gear Shop',
    quarterMm: 'ကမ်းနားလမ်း မြောက်ပိုင်း',
  },
  bldg_palm_spring: { near: { x: 150, z: -650 } },
  bldg_amber_palace: { near: { x: -350, z: -450 } },
  bldg_hotel_myitkyina: { near: { x: 520, z: -260 } },
  bldg_wun_tawp: { near: { x: -250, z: 300 } },
  bldg_myitkyina_cafe: { near: { x: 120, z: -300 } },
  bldg_sitapu_weaving: { near: { x: 350, z: 420 } },
  bldg_sitapu_baptist: {
    near: { x: MAP_PLACES.kachinBaptist.x - 60, z: MAP_PLACES.kachinBaptist.z },
    quarterMm: 'ကချင်နှစ်ခြင်း အသင်းချုပ် ရပ်ကွက်',
  },
  // Myitkyina University is outside the 3 km play area
  bldg_university_hall: null,
};

export const MYITKYINA_FAMOUS_BUILDINGS: FamousBuildingInfo[] = LEGACY_FAMOUS_BUILDINGS.flatMap((b) => {
  const place = FAMOUS_PLACEMENT[b.id];
  if (place === null) return [];
  const near = place ? place.near : { x: b.x * 2.6, z: b.z * 2.6 };
  const lot = reserveLot(near.x, near.z, b.width, b.depth);
  const ll = worldToLatLng(lot.x, lot.z);
  return [
    {
      ...b,
      ...(place?.nameMm ? { nameMm: place.nameMm } : {}),
      ...(place?.nameEn ? { nameEn: place.nameEn } : {}),
      ...(place?.quarterMm ? { quarterMm: place.quarterMm } : {}),
      x: Math.round(lot.x),
      z: Math.round(lot.z),
      lat: ll.lat,
      lng: ll.lng,
    },
  ];
});

// ============================================================================
// REALISTIC MULTI-SURFACE ROAD NETWORK IN SITAPU QUARTER (20KM SCALE)
// Roads terminate cleanly at the Manau Park perimeter gates (±36m) and run alongside
// city blocks so NO road ever cuts through Manau Park or any building!
// ============================================================================
export const MYITKYINA_ROAD_SEGMENTS: RoadSegmentDef[] = OSM_ROAD_SEGMENTS;

/** Traffic lights at real junctions where 3+ paved main-road segments meet (up to 4, spread out). */
function findMainJunctions(): { id: string; x: number; z: number; nameMm: string }[] {
  const counts = new Map<string, { x: number; z: number; n: number; name: string }>();
  for (const s of OSM_ROAD_SEGMENTS) {
    if (s.surface !== 'asphalt') continue;
    for (const [x, z] of [
      [s.x1, s.z1],
      [s.x2, s.z2],
    ]) {
      const k = `${Math.round(x / 3)},${Math.round(z / 3)}`;
      const e = counts.get(k) || { x, z, n: 0, name: s.nameMm };
      e.n++;
      if (!e.name && s.nameMm) e.name = s.nameMm;
      counts.set(k, e);
    }
  }
  const junctions = [...counts.values()]
    .filter((e) => e.n >= 3)
    .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const picked: typeof junctions = [];
  for (const j of junctions) {
    if (picked.length >= 4) break;
    if (picked.every((p) => Math.hypot(p.x - j.x, p.z - j.z) > 250)) picked.push(j);
  }
  return picked.map((j, i) => ({
    id: `tl_osm_${i}`,
    x: Math.round(j.x),
    z: Math.round(j.z),
    nameMm: j.name ? `${j.name} လမ်းဆုံ မီးပွိုင့်` : 'လမ်းဆုံ မီးပွိုင့်',
  }));
}

export const MYITKYINA_TRAFFIC_LIGHTS: { id: string; x: number; z: number; nameMm: string }[] =
  findMainJunctions();

const LUNG_GA_PA = MYITKYINA_FAMOUS_BUILDINGS.find((b) => b.id === 'bldg_lung_ga_pa') ?? { x: -70, z: 70 };

export const INITIAL_QUESTS: QuestObjective[] = [
  {
    id: 'quest_fishing',
    titleMm: 'ငါးမျှားတံဝယ်ပြီး ဧရာဝတီကမ်းနားတွင် ငါး (၃) ကောင်ဖမ်း၍ ငါးဆိုင်သွင်းပါ',
    titleEn: 'Buy Fishing Gear, Catch 3 Fish & Sell at the Fish Shop',
    descriptionMm:
      'အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ဝယ်ယူပြီး ဆုတောင်းပြည့်စေတီ ကမ်းနား သို့မဟုတ် ကမ်းနားလမ်း ငါးမျှားဆိပ်တွင် ငါး (၃) ကောင်ဖမ်း၍ ငါးအဝယ်ဒိုင်သို့ ရောင်းချပါ',
    targetRegion: 'pagoda_riverfront',
    targetX: MAP_PLACES.pagodaJetty.x,
    targetZ: MAP_PLACES.pagodaJetty.z,
    progress: 0,
    goal: 3,
    rewardJade: 50000,
    completed: false,
  },
  {
    id: 'quest_delivery',
    titleMm: 'ဘက်ထရီဆိုင်ကယ်ဖြင့် ကချင်ထမင်းဟင်း (၃) နေရာ ပို့ဆောင်ပါ',
    titleEn: 'AIMA E-Bike Kachin Food Delivery Job (3 Stops)',
    descriptionMm: 'လုံဂါပါ ကချင်ရိုးရာဆိုင်မှ အော်ဒါယူပြီး မြို့တွင်း ၃ နေရာသို့ အချိန်မီ လိုက်ပို့၍ ဝင်ငွေရှာပါ',
    targetRegion: 'manau_park',
    targetX: LUNG_GA_PA.x,
    targetZ: LUNG_GA_PA.z,
    progress: 0,
    goal: 3,
    rewardJade: 40000,
    completed: false,
  },
  {
    id: 'quest_station',
    titleMm: 'ဘူတာရုံ ခရီးသည် ပစ္စည်းထမ်း — ရထားခရီးသည်၏ ခရီးဆောင်အိတ်ကို ဟိုတယ်သို့ ပို့ပါ',
    titleEn: 'Station Porter: Carry a Passenger’s Luggage to the Hotel',
    descriptionMm:
      'မန္တလေးမှ ရထားဆိုက်ပြီ! မြစ်ကြီးနား မီးရထားဘူတာ ရှေ့တွင် ခရီးဆောင်အိတ်ကို ယူပြီး Hotel Myitkyina သို့ အချိန်မီ ပို့ဆောင်ပေးပါ',
    targetRegion: 'railway_station',
    targetX: 0,
    targetZ: 0,
    progress: 0,
    goal: 2,
    rewardJade: 40000,
    completed: false,
  },
  {
    id: 'quest_manau_rhythm',
    titleMm: 'မနောကွင်းတွင် ရိုးရာမနောအက သံစဉ်ချက် (၈) ချက် မှန်အောင်ကပါ',
    titleEn: 'Complete the Manau Rhythm Dance Performance (8 Beats)',
    descriptionMm:
      'မနောကွင်းအလယ်တွင် မနောအက စတင်ပြီး ကချင်ရိုးရာတေးသံစဉ် စည်းချက်အလိုက် ခလုတ် (◀/▲/▼/▶) တို့ကို အချိန်မီနှိပ်၍ ကခုန်ပါ',
    targetRegion: 'manau_park',
    targetX: 0,
    targetZ: 7,
    progress: 0,
    goal: 8,
    rewardJade: 35000,
    completed: false,
  },
  {
    id: 'quest_timetrial',
    titleMm: 'မြို့လယ် ဆိုင်ကယ်/ကား ပြိုင်ပွဲ (ဂိတ် ၆ ခု)',
    titleEn: 'Downtown Street Time Trial (6 Checkpoints)',
    descriptionMm: 'မနောကွင်းအဝင်မှ စတင်ပြီး မြို့လယ်လမ်းမကြီးများပေါ်ရှိ ဂိတ် (၆) ခုကို အချိန်မီ ဖြတ်မောင်းပါ',
    targetRegion: 'manau_park',
    targetX: 0,
    targetZ: 60,
    progress: 0,
    goal: 6,
    rewardJade: 45000,
    completed: false,
  },
  {
    id: 'quest_manau',
    titleMm: 'မနောတိုင် စည်တော် (၄) ခု တီးခတ်ပါ',
    titleEn: 'Awaken the 4 Sacred Manau Drums',
    descriptionMm: 'မနောကွင်းကြီးရှိ မနောတိုင်စည်တော် (၄) ခုအနီး သွားပြီး E နှိပ်၍ မနောပွဲတော် စတင်ပါ',
    targetRegion: 'manau_park',
    targetX: 0,
    targetZ: 0,
    progress: 0,
    goal: 4,
    rewardJade: 25000,
    completed: false,
  },
  {
    // id kept from the old bridge quest so existing saves carry over
    id: 'quest_bridge',
    titleMm: 'ကမ်းနားလမ်း ဧရာဝတီကမ်းစပ် ဂိတ် (၃) ခု ဖြတ်သန်းပါ',
    titleEn: 'Strand Road Riverside Run (3 Checkpoints)',
    descriptionMm: 'ဧရာဝတီ အနောက်ကမ်း ကမ်းနားလမ်းတစ်လျှောက် မောင်းနှင်/ပြေးလွှားပြီး ဂိတ် (၃) ခု ဖြတ်ပါ',
    targetRegion: 'strand_road',
    targetX: MAP_PLACES.strandNorth.x,
    targetZ: MAP_PLACES.strandNorth.z,
    progress: 0,
    goal: 3,
    rewardJade: 30000,
    completed: false,
  },
  {
    id: 'quest_smugglers',
    titleMm: 'ကမ်းနားလမ်းအနီးရှိ မှောင်ခိုဂိုဏ်း (၅) ဦး နှိမ်နင်းပါ',
    titleEn: 'Defeat 5 Rogue Smugglers (Security Bounty Job)',
    descriptionMm: 'ကချင်ဓား (Nhtu) သို့မဟုတ် 4x4 ကားဖြင့် မြစ်ကမ်းနား မှောင်ခိုဂိုဏ်းသားများကို တိုက်ခိုက်နှိမ်နင်း၍ ဆုကြေးငွေ ရယူပါ',
    targetRegion: 'strand_road',
    targetX: MAP_PLACES.strandNorth.x,
    targetZ: MAP_PLACES.strandNorth.z - 120,
    progress: 0,
    goal: 5,
    rewardJade: 60000,
    completed: false,
  },
  {
    id: 'quest_explorer',
    titleMm: 'မြစ်ကြီးနား မြို့ပတ်ခရီး — နာမည်ကြီးနေရာ (၄) ခု လည်ပတ်ပါ',
    titleEn: 'Myitkyina City Tour — Visit 4 Famous Landmarks',
    descriptionMm:
      'မီးရထားဘူတာ → မြို့မဈေး → ဆုတောင်းပြည့်စေတီ ကမ်းနား → ကချင်နှစ်ခြင်း အသင်းချုပ် အစဉ်လိုက် သွားရောက်လည်ပတ်ပါ (GPS လမ်းညွှန်အတိုင်း)',
    targetRegion: 'railway_station',
    targetX: 0,
    targetZ: 0,
    progress: 0,
    goal: 4,
    rewardJade: 55000,
    completed: false,
  },
  {
    id: 'quest_rare_fish',
    titleMm: 'ဧရာဝတီ ရှားပါးငါး (Rare/Legendary) (၂) ကောင် ဖမ်းပါ',
    titleEn: 'Catch 2 Rare or Legendary Ayeyarwady Fish',
    descriptionMm: 'ငါးမျှားတံကို Lv.2 သို့ အဆင့်မြှင့်ပြီး ကမ်းနားလမ်း ငါးမျှားဆိပ်တွင် ရှားပါးငါး (၂) ကောင် ဖမ်းယူပါ',
    targetRegion: 'strand_road',
    targetX: MAP_PLACES.strandNorth.x,
    targetZ: MAP_PLACES.strandNorth.z,
    progress: 0,
    goal: 2,
    rewardJade: 70000,
    completed: false,
  },
];

/** quest_station: pick the luggage up in front of the station, drop it at the hotel door. */
const STATION_HOTEL =
  MYITKYINA_FAMOUS_BUILDINGS.find((b) => b.id === 'bldg_hotel_myitkyina') ?? MAP_PLACES.downtown;
export const STATION_QUEST = {
  pickup: roadsidePoint(MAP_PLACES.railwayStation.x, MAP_PLACES.railwayStation.z, 2),
  dropoff: roadsidePoint(STATION_HOTEL.x, STATION_HOTEL.z, 2),
  hotelNameMm: 'Hotel Myitkyina',
  /** Seconds allowed from pickup to delivery */
  timeLimitSec: 200,
};

/** Ordered stops for quest_explorer; progress N means stop N is next. */
export const CITY_TOUR_STOP_IDS: RegionId[] = [
  'railway_station',
  'downtown_market',
  'pagoda_riverfront',
  'kachin_baptist',
];

