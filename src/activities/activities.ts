/**
 * Activities and mini-games at the four landmarks (V2 "relax and explore": no failing, only a
 * score or time to beat). Each one starts at a glowing marker in the world (walk up, press E)
 * or from the menu.
 *
 * - Railway station: 🎫 ticket counter (sell the right ticket on the Mandalay–Myitkyina line)
 * - Railway station: 🛵 city ride on the e-bike, rings along real streets past the landmarks
 * - Railway station: ✈ Sky EV tour, rings in the sky over the station, Manau park, pagoda, river
 * - Manau park: 🪶 join the Manau dance line, a winding path around the poles with dancers
 * - Sutaungpyae: 🙏 birthday corner (နေ့နံ): find your weekday's planetary post and pour water
 * - Aung Myin Thar: 🛟 tubing down the stream, steer to collect floating flowers
 */
import * as THREE from 'three';
import { groundHeightAt, playableSurfaceHeightAt } from '../world/terrain';
import { stationWorld } from '../world/railwayStation';
import { SUTAUNGPYAE } from '../world/sutaungpyae';
import {
  AUNG_MYIN_THAR,
  STREAM_LENGTH,
  STREAM_RAPIDS_LOCAL,
  STREAM_WATER_Y,
  streamSample,
} from '../world/aungMyinThar';
import { nearestStreetPoint } from '../world/worldLayout';

export type ActivityId = 'ride_city' | 'sky_tour' | 'station_tickets' | 'manau_dance' | 'pagoda_birthday' | 'amt_tubing';
type Kind = 'rings' | 'tickets' | 'birthday' | 'tubing';

interface ActivityDef {
  id: ActivityId;
  kind: Kind;
  icon: string;
  titleMm: string;
  placeMm: string;
  descMm: string;
  start: { x: number; z: number };
  vehicle?: 'ebike' | 'skyev';
  /** How results compare: lower time or higher score is better */
  scoring: 'time' | 'score';
}

const MANAU = { x: 0, z: 3 };

export const ACTIVITIES: ActivityDef[] = [
  {
    id: 'station_tickets',
    kind: 'tickets',
    icon: '🎫',
    titleMm: 'လက်မှတ်ရောင်း ကောင်တာ',
    placeMm: 'မြစ်ကြီးနား ဘူတာကြီး',
    descMm: 'ခရီးသည်တွေ သွားချင်တဲ့ ဘူတာအတွက် မှန်တဲ့ လက်မှတ်ကို ရွေးပေးပါ (၉၀ စက္ကန့်)',
    start: stationWorld(13, 5),
    scoring: 'score',
  },
  {
    id: 'ride_city',
    kind: 'rings',
    icon: '🛵',
    titleMm: 'ဆိုင်ကယ်နဲ့ မြို့ပတ်',
    placeMm: 'ဘူတာ → မနောကွင်း → ဆုတောင်းပြည့်',
    descMm: 'ဘက်ထရီဆိုင်ကယ်စီးပြီး လမ်းပေါ်က ကွင်းတွေကို ဖြတ်ကာ အထင်ကရနေရာ ၃ ခုကို ပတ်ပါ',
    start: stationWorld(30, -18),
    vehicle: 'ebike',
    scoring: 'time',
  },
  {
    id: 'sky_tour',
    kind: 'rings',
    icon: '✈',
    titleMm: 'ကားပျံနဲ့ ကောင်းကင်ခရီး',
    placeMm: 'မြို့ပေါ် ကောင်းကင်',
    descMm: 'ကချင်မိုးပျံ EV နဲ့ ဘူတာ၊ မနောကွင်း၊ ဆုတောင်းပြည့်နဲ့ ဧရာဝတီပေါ်က ကောင်းကင်ကွင်းတွေကို ဖြတ်ပျံပါ',
    start: stationWorld(37, 25),
    vehicle: 'skyev',
    scoring: 'time',
  },
  {
    id: 'manau_dance',
    kind: 'rings',
    icon: '🪶',
    titleMm: 'မနော ကခုန်တန်း',
    placeMm: 'မနောကွင်း',
    descMm: 'ကချင်ကခုန်သူတွေနဲ့အတူ မနောတိုင်ကို ကွေ့ကောက်လမ်းအတိုင်း လိုက်ကပါ',
    start: { x: 10, z: 30 },
    scoring: 'time',
  },
  {
    id: 'pagoda_birthday',
    kind: 'birthday',
    icon: '🙏',
    titleMm: 'နေ့နံထောင့် ရေသပ္ပာယ်',
    placeMm: 'ဆုတောင်းပြည့်ဘုရား',
    descMm: 'သင်မွေးတဲ့နေ့ကို ရွေးပြီး စေတီပတ်လည်က သင့်နေ့နံထောင့်ကို ရှာ၍ ရေသပ္ပာယ်ပါ',
    start: { x: SUTAUNGPYAE.x + 3, z: SUTAUNGPYAE.z + 22 },
    scoring: 'time',
  },
  {
    id: 'amt_tubing',
    kind: 'tubing',
    icon: '🛟',
    titleMm: 'ကွင်းစီး ရေမျော',
    placeMm: 'အောင်မြင်သာ',
    descMm: 'ကွင်းပေါ်ထိုင်ပြီး ချောင်းရေအတိုင်း မျောပါ။ ဘယ်/ညာ ထိန်းပြီး ရေပေါ်က ပန်းတွေကို ကောက်ပါ',
    start: { x: AUNG_MYIN_THAR.x + 92, z: AUNG_MYIN_THAR.z - 76 },
    scoring: 'score',
  },
];

// ---- Ticket counter data: stations on the Mandalay–Myitkyina line ----
const TICKET_STATIONS = ['မိုးကောင်း', 'ဟိုပင်', 'မိုးညှင်း', 'နဘား', 'ကောလင်း', 'ရွှေဘို', 'မန္တလေး', 'ကသာ'];
const PASSENGERS = ['ဒေါ်ခင်', 'ဦးဇော်', 'မနော်ဂျာ', 'ကိုထက်', 'ဒေါ်ဆိုင်းနု', 'ဦးဘရန်', 'မမြတ်', 'ကိုဂမ်', 'ဒေါ်လုံး', 'မစိုး'];
const TICKET_GOAL = 10;
const TICKET_TIME = 90;

// ---- Planetary posts around the stupa (traditional Burmese weekday corners) ----
export const BIRTHDAY_POSTS: { id: string; dayMm: string; animalMm: string; dirMm: string; angle: number; color: string }[] = [
  { id: 'fri', dayMm: 'သောကြာ', animalMm: 'ပူး', dirMm: 'မြောက်', angle: 0, color: '#c9a227' },
  { id: 'sun', dayMm: 'တနင်္ဂနွေ', animalMm: 'ဂဠုန်', dirMm: 'အရှေ့မြောက်', angle: 45, color: '#d14b3c' },
  { id: 'mon', dayMm: 'တနင်္လာ', animalMm: 'ကျား', dirMm: 'အရှေ့', angle: 90, color: '#e08a2c' },
  { id: 'tue', dayMm: 'အင်္ဂါ', animalMm: 'ခြင်္သေ့', dirMm: 'အရှေ့တောင်', angle: 135, color: '#e6c25a' },
  { id: 'wed', dayMm: 'ဗုဒ္ဓဟူး', animalMm: 'ဆင်စွယ်ရှိ', dirMm: 'တောင်', angle: 180, color: '#3f8f5a' },
  { id: 'sat', dayMm: 'စနေ', animalMm: 'နဂါး', dirMm: 'အနောက်တောင်', angle: 225, color: '#5b6f8f' },
  { id: 'thu', dayMm: 'ကြာသပတေး', animalMm: 'ကြွက်', dirMm: 'အနောက်', angle: 270, color: '#8a6d4c' },
  { id: 'rahu', dayMm: 'ရာဟု (ဗုဒ္ဓဟူး ညနေ)', animalMm: 'ဟိုင်း (ဆင်စွယ်မဲ့)', dirMm: 'အနောက်မြောက်', angle: 315, color: '#6b6b6b' },
];
const POST_RADIUS = 10.6;
function postPos(angleDeg: number) {
  // angle measured clockwise from north (−z), so east is +x
  const a = (angleDeg * Math.PI) / 180;
  return { x: SUTAUNGPYAE.x + Math.sin(a) * POST_RADIUS, z: SUTAUNGPYAE.z - Math.cos(a) * POST_RADIUS };
}

export interface ActivityHud {
  prompt: { id: ActivityId; icon: string; titleMm: string; descMm: string } | null;
  active: {
    id: ActivityId;
    kind: Kind;
    icon: string;
    titleMm: string;
    stepMm: string;
    progress: number;
    goal: number;
    score: number;
    seconds: number;
    timeLeft: number | null;
    ticket: { passengerMm: string; destMm: string; options: string[]; feedback: 'ok' | 'wrong' | null } | null;
    birthday: { choosing: boolean; options: { id: string; labelMm: string }[]; targetMm: string | null } | null;
  } | null;
  result: { id: ActivityId; icon: string; titleMm: string; lines: string[]; bestMm: string | null; newBest: boolean } | null;
  list: { id: ActivityId; icon: string; titleMm: string; placeMm: string; done: boolean; bestMm: string | null }[];
}

interface UpdateCtx {
  dt: number;
  elapsed: number;
  playerX: number;
  playerY: number;
  playerZ: number;
  vehicle: string;
  /** Left/right steering input −1..1 (stick or A/D) */
  steer: number;
}

interface Deps {
  scene: THREE.Scene;
  showBanner: (title: string, subtitle: string) => void;
  playRing: () => void;
  playWin: () => void;
  playSplash: () => void;
  summonVehicle: (type: 'ebike' | 'skyev') => void;
  teleport: (x: number, z: number, heading: number) => void;
  setWaypoint: (x: number, z: number, labelMm: string) => void;
  /** Put the player at a position (movement-locked activities) */
  placePlayer: (x: number, y: number, z: number, heading: number) => void;
  burst: (x: number, y: number, z: number, color: string) => void;
}

const BEST_KEY = 'myitkyina-activity-best-v1';
const loadBest = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {};
  } catch {
    return {};
  }
};
const saveBest = (b: Record<string, number>) => {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(b));
  } catch {
    /* storage blocked */
  }
};
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let seed = 777;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

function labelSprite(text: string, sub: string, bg = 'rgba(15,23,42,0.85)') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(8, 8, 496, 144, 36);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 54px "Noto Sans Myanmar", "Myanmar Text", Padauk, "Myanmar Sangam MN", sans-serif';
  g.fillText(text, 256, 62);
  g.font = '30px "Noto Sans Myanmar", "Myanmar Text", Padauk, sans-serif';
  g.fillStyle = '#fde68a';
  g.fillText(sub, 256, 120);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(4.2, 1.3, 1);
  return s;
}

/** Simple Kachin dancer: black jacket, red longyi, hornbill-feather headdress, arms raised. */
function dancer(color: string): THREE.Group {
  const g = new THREE.Group();
  const m = (c: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, envMapIntensity: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.75, 10), m('#1b1b1f'));
  body.position.y = 1.3;
  g.add(body);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.85, 10), m(color));
  skirt.position.y = 0.5;
  g.add(skirt);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), m('#b98060'));
  head.position.y = 1.9;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 12), m('#c8102e'));
  hat.position.y = 2.05;
  g.add(hat);
  const feather = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.7, 6), m('#f5f0e1'));
  feather.position.set(0, 2.45, -0.05);
  feather.rotation.x = -0.25;
  g.add(feather);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), m('#1b1b1f'));
    arm.position.set(s * 0.38, 1.75, 0.05);
    arm.rotation.z = s * 2.4;
    arm.name = s < 0 ? 'armL' : 'armR';
    g.add(arm);
    const fan = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#f2c12e', side: THREE.DoubleSide }));
    fan.position.set(s * 0.6, 2.05, 0.05);
    g.add(fan);
  }
  return g;
}

export function createActivityRunner(deps: Deps) {
  const root = new THREE.Group();
  deps.scene.add(root);
  let best = loadBest();
  let done = new Set<string>(Object.keys(best));

  // ---- Start markers: a soft light pillar, a ring on the ground and a floating label ----
  const markers = new Map<ActivityId, THREE.Group>();
  for (const a of ACTIVITIES) {
    const g = new THREE.Group();
    const y = groundHeightAt(a.start.x, a.start.z);
    g.position.set(a.start.x, y, a.start.z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.6, 0.08, 8, 40),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.12;
    g.add(ring);
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.5, 7, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: '#fde68a', transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 3.5;
    g.add(pillar);
    const label = labelSprite(`${a.icon} ${a.titleMm}`, a.placeMm);
    label.position.y = 4.2;
    g.add(label);
    root.add(g);
    markers.set(a.id, g);
  }

  // ---- Ring checkpoints (rides, sky tour, dance) ----
  const ringMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.85 });
  const ringNextMat = new THREE.MeshBasicMaterial({ color: '#a5f3fc', transparent: true, opacity: 0.3 });
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 10, 48), ringMat);
  const ringNext = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), ringNextMat);
  ringMesh.visible = false;
  ringNext.visible = false;
  root.add(ringMesh, ringNext);

  // ---- Planetary posts at the pagoda (always visible; part of the real terrace) ----
  for (const p of BIRTHDAY_POSTS) {
    const pos = postPos(p.angle);
    const y = playableSurfaceHeightAt(pos.x, pos.z);
    const g = new THREE.Group();
    g.position.set(pos.x, y, pos.z);
    g.rotation.y = Math.atan2(pos.x - SUTAUNGPYAE.x, pos.z - SUTAUNGPYAE.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.6, envMapIntensity: 0.3 }));
    base.position.y = 0.4;
    g.add(base);
    const buddha = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 10), new THREE.MeshStandardMaterial({ color: '#e0a92e', metalness: 0.8, roughness: 0.3 }));
    buddha.position.y = 1.18;
    g.add(buddha);
    const animal = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.6), new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.5, envMapIntensity: 0.3 }));
    animal.position.set(0, 0.15, 0.85);
    g.add(animal);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.14, 12), new THREE.MeshStandardMaterial({ color: '#c0c6cc', metalness: 0.8, roughness: 0.25 }));
    bowl.position.set(0.35, 0.87, 0.35);
    g.add(bowl);
    const label = labelSprite(p.dayMm, `${p.animalMm} · ${p.dirMm}`, 'rgba(120,53,15,0.85)');
    label.scale.set(2.6, 0.8, 1);
    label.position.y = 2.2;
    g.add(label);
    root.add(g);
  }

  // ---- Manau dancers (only during the dance) ----
  const dancers: THREE.Group[] = [];
  const dancerColors = ['#c8102e', '#1f7a3a', '#c8102e', '#1f4fa0', '#c8102e', '#1f7a3a', '#c8102e', '#1f4fa0'];
  for (const c of dancerColors) {
    const d = dancer(c);
    d.visible = false;
    root.add(d);
    dancers.push(d);
  }

  // ---- Tubing props: the inner tube under the player and floating flowers ----
  const tube = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.26, 10, 24), new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.7 }));
  tube.rotation.x = Math.PI / 2;
  tube.visible = false;
  root.add(tube);
  const flowers: { mesh: THREE.Group; s: number; off: number; taken: boolean }[] = [];
  const flowerProto = () => {
    const g = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: '#f472b6', roughness: 0.5, emissive: '#9d174d', emissiveIntensity: 0.25 });
    for (let k = 0; k < 6; k++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), petalMat);
      petal.scale.set(1, 0.35, 0.55);
      const a = (k / 6) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25);
      petal.rotation.y = -a;
      g.add(petal);
    }
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: '#fde047' }));
    g.add(mid);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshStandardMaterial({ color: '#3f8f3a', side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = -0.05;
    g.add(pad);
    return g;
  };

  // ---- Paths ----
  const S = SUTAUNGPYAE;
  const streetPt = (x: number, z: number) => {
    const p = nearestStreetPoint(x, z, true);
    return { x: p.x, z: p.z };
  };
  const lerpPts = (a: { x: number; z: number }, b: { x: number; z: number }, n: number) => {
    const out: { x: number; z: number }[] = [];
    for (let k = 1; k <= n; k++) out.push(streetPt(a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n));
    return out;
  };
  const stationFront = stationWorld(48, -10);
  const rideRings = (() => {
    const manauGate = { x: -192, z: -32 };
    const pagodaGate = { x: S.x, z: S.z + 60 };
    const pts = [...lerpPts(stationFront, manauGate, 6), ...lerpPts(manauGate, pagodaGate, 3), ...lerpPts(pagodaGate, stationFront, 6)];
    // drop rings that ended up almost on top of each other after snapping to streets
    return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 60).map((p) => ({ ...p, alt: 2.6, r: 5 }));
  })();
  const skyRings = [
    { ...stationWorld(0, 0), alt: 45, r: 9 },
    { x: -500, z: 1700, alt: 70, r: 10 },
    { x: -250, z: 700, alt: 60, r: 10 },
    { x: 0, z: 3, alt: 55, r: 10 },
    { x: S.x, z: S.z, alt: 48, r: 9 },
    { x: 260, z: 450, alt: 35, r: 10 },
    { x: 150, z: 1400, alt: 40, r: 10 },
    { ...stationWorld(40, 0), alt: 30, r: 10 },
  ];
  const danceRings = (() => {
    const out: { x: number; z: number; alt: number; r: number }[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2 + Math.PI / 2;
      const rad = k % 2 === 0 ? 26 : 16;
      out.push({ x: MANAU.x + Math.cos(a) * rad, z: MANAU.z + Math.sin(a) * rad, alt: 1.6, r: 3 });
    }
    return out;
  })();

  // ---- Runtime state ----
  type Active = {
    def: ActivityDef;
    t: number;
    progress: number;
    goal: number;
    score: number;
    rings?: { x: number; z: number; alt: number; r: number }[];
    ticketQ?: { passengerMm: string; destMm: string; options: string[] };
    ticketFeedback?: { kind: 'ok' | 'wrong'; until: number };
    birthdayChoice?: string | null;
    birthdayHint?: number;
    tubeS?: number;
    tubeOff?: number;
  };
  let active: Active | null = null;
  let prompt: ActivityDef | null = null;
  let result: ActivityHud['result'] = null;

  const nextTicket = (): Active['ticketQ'] => {
    const dest = TICKET_STATIONS[Math.floor(Math.random() * TICKET_STATIONS.length)];
    const others = shuffle(TICKET_STATIONS.filter((d) => d !== dest)).slice(0, 3);
    return {
      passengerMm: PASSENGERS[Math.floor(Math.random() * PASSENGERS.length)],
      destMm: dest,
      options: shuffle([dest, ...others]),
    };
  };

  const finish = (lines: string[]) => {
    if (!active) return;
    const def = active.def;
    const value = def.scoring === 'time' ? Math.round(active.t) : active.score;
    const prev = best[def.id];
    const newBest = prev === undefined || (def.scoring === 'time' ? value < prev : value > prev);
    if (newBest) {
      best = { ...best, [def.id]: value };
      saveBest(best);
    }
    done.add(def.id);
    const bestVal = best[def.id];
    result = {
      id: def.id,
      icon: def.icon,
      titleMm: def.titleMm,
      lines,
      bestMm: def.scoring === 'time' ? `အမြန်ဆုံး ${fmtTime(bestVal)}` : `အမြင့်ဆုံး ${bestVal} မှတ်`,
      newBest,
    };
    deps.playWin();
    cleanup();
  };

  const cleanup = () => {
    ringMesh.visible = false;
    ringNext.visible = false;
    dancers.forEach((d) => (d.visible = false));
    tube.visible = false;
    flowers.forEach((f) => root.remove(f.mesh));
    flowers.length = 0;
    active = null;
  };

  const start = (id: ActivityId, teleport: boolean) => {
    const def = ACTIVITIES.find((a) => a.id === id);
    if (!def) return;
    cleanup();
    result = null;
    if (teleport) deps.teleport(def.start.x, def.start.z + 3, Math.PI);
    const a: Active = { def, t: 0, progress: 0, goal: 1, score: 0 };
    if (def.id === 'ride_city') a.rings = rideRings;
    if (def.id === 'sky_tour') a.rings = skyRings;
    if (def.id === 'manau_dance') a.rings = danceRings;
    if (a.rings) a.goal = a.rings.length;
    if (def.kind === 'tickets') {
      a.goal = TICKET_GOAL;
      a.ticketQ = nextTicket();
    }
    if (def.kind === 'birthday') {
      a.goal = 1;
      a.birthdayChoice = null;
    }
    if (def.kind === 'tubing') {
      // drift the stretch from above the first rapids to past the huts
      a.tubeS = 120;
      a.tubeOff = 0;
      a.goal = 12;
      for (let k = 0; k < 12; k++) {
        const s = 150 + k * 26;
        const off = (rand() - 0.5) * 10;
        const f = { mesh: flowerProto(), s, off, taken: false };
        root.add(f.mesh);
        flowers.push(f);
      }
      tube.visible = true;
    }
    if (def.vehicle) deps.summonVehicle(def.vehicle);
    if (def.id === 'manau_dance') dancers.forEach((d) => (d.visible = true));
    active = a;
    deps.showBanner(`${def.icon} ${def.titleMm}`, def.descMm);
  };

  const ringWorldY = (r: { x: number; z: number; alt: number }) => groundHeightAt(r.x, r.z) + r.alt;

  const update = (c: UpdateCtx) => {
    // Prompt when standing at a start marker (and not busy)
    prompt = null;
    if (!active) {
      for (const a of ACTIVITIES) {
        if (Math.hypot(a.start.x - c.playerX, a.start.z - c.playerZ) < 4.5) {
          prompt = a;
          break;
        }
      }
    }
    // Marker animation (only nearby ones matter, cheap anyway)
    for (const [id, g] of markers) {
      g.visible = !active || active.def.id !== id;
      g.children[0].rotation.z = c.elapsed * 0.8;
      g.children[2].position.y = 4.2 + Math.sin(c.elapsed * 2 + g.position.x) * 0.15;
    }
    if (!active) return;
    const a = active;
    a.t += c.dt;

    if (a.rings) {
      const target = a.rings[a.progress];
      const after = a.rings[a.progress + 1];
      if (target) {
        const ty = ringWorldY(target);
        ringMesh.visible = true;
        ringMesh.position.set(target.x, ty, target.z);
        ringMesh.scale.setScalar(target.r);
        const look = after ?? { x: target.x + 1, z: target.z };
        ringMesh.rotation.set(0, Math.atan2(look.x - target.x, look.z - target.z), 0);
        if (after) {
          ringNext.visible = true;
          ringNext.position.set(after.x, ringWorldY(after), after.z);
          ringNext.scale.setScalar(after.r);
          ringNext.rotation.copy(ringMesh.rotation);
        } else ringNext.visible = false;
        deps.setWaypoint(target.x, target.z, `${a.def.icon} ကွင်း ${a.progress + 1}/${a.goal}`);
        const dh = Math.hypot(target.x - c.playerX, target.z - c.playerZ);
        const dy = Math.abs(ty - (c.playerY + 1.2));
        const inVehicle = !a.def.vehicle || c.vehicle === a.def.vehicle;
        if (inVehicle && dh < target.r && dy < target.r + 2) {
          a.progress++;
          deps.playRing();
          deps.burst(target.x, ty, target.z, '#22d3ee');
          if (a.progress >= a.goal) {
            finish([`ကွင်း ${a.goal} ခုလုံး ဖြတ်ပြီးပါပြီ`, `ကြာချိန် ${fmtTime(a.t)}`]);
            return;
          }
        }
      }
      if (a.def.id === 'manau_dance') {
        // dancers lead the line along the same winding path
        const pts = danceRings;
        const total = pts.length - 1;
        dancers.forEach((d, i) => {
          const u = ((c.elapsed * 0.09 + i * 0.045) % 1) * total;
          const k = Math.floor(u);
          const f = u - k;
          const p0 = pts[k];
          const p1 = pts[Math.min(k + 1, total)];
          const x = p0.x + (p1.x - p0.x) * f;
          const z = p0.z + (p1.z - p0.z) * f;
          d.position.set(x, groundHeightAt(x, z) + Math.abs(Math.sin(c.elapsed * 5 + i)) * 0.15, z);
          d.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
          const armL = d.getObjectByName('armL');
          const armR = d.getObjectByName('armR');
          if (armL) armL.rotation.z = -2.4 + Math.sin(c.elapsed * 5 + i) * 0.3;
          if (armR) armR.rotation.z = 2.4 - Math.sin(c.elapsed * 5 + i) * 0.3;
        });
      }
    }

    if (a.def.kind === 'tickets') {
      const left = TICKET_TIME - a.t;
      if (left <= 0) {
        finish([`ရောင်းပြီး လက်မှတ် ${a.score} စောင်`, 'ခရီးသည်တွေ ကျေနပ်ကြပါတယ်']);
        return;
      }
    }

    if (a.def.kind === 'birthday' && a.birthdayChoice) {
      const post = BIRTHDAY_POSTS.find((p) => p.id === a.birthdayChoice)!;
      const pos = postPos(post.angle);
      deps.setWaypoint(pos.x, pos.z, `${post.dayMm} ထောင့်`);
      for (const p of BIRTHDAY_POSTS) {
        const pp = postPos(p.angle);
        if (Math.hypot(pp.x - c.playerX, pp.z - c.playerZ) < 2.4) {
          if (p.id === post.id) {
            a.score = 1;
            deps.playSplash();
            deps.burst(pp.x, c.playerY + 1.2, pp.z, '#7dd3fc');
            finish([
              `${post.dayMm}နံ — ${post.animalMm} · ${post.dirMm}ထောင့်`,
              'ရေသပ္ပာယ်ပြီးပါပြီ — ကျန်းမာချမ်းသာပါစေ',
              `ကြာချိန် ${fmtTime(a.t)}`,
            ]);
            return;
          } else if ((a.birthdayHint ?? 0) < c.elapsed) {
            a.birthdayHint = c.elapsed + 3;
            deps.showBanner(`ဒါက ${p.dayMm}နံ (${p.dirMm}) ပါ`, `${post.dayMm}နံက ${post.dirMm}ထောင့်မှာ ရှိပါတယ်`);
          }
        }
      }
    }

    if (a.def.kind === 'tubing' && a.tubeS !== undefined) {
      const sm = streamSample(a.tubeS);
      const lx = sm.x - AUNG_MYIN_THAR.x;
      const lz = sm.z - AUNG_MYIN_THAR.z;
      const inRapid = STREAM_RAPIDS_LOCAL.some(([rx, rz]) => Math.hypot(rx - lx, rz - lz) < 14);
      const speed = inRapid ? 5.2 : 2.8;
      a.tubeS += speed * c.dt;
      a.tubeOff = THREE.MathUtils.clamp((a.tubeOff ?? 0) - c.steer * 3.2 * c.dt, -6, 6);
      // perpendicular to the flow: (−dirZ, dirX)
      const x = sm.x - sm.dirZ * a.tubeOff;
      const z = sm.z + sm.dirX * a.tubeOff;
      const bob = Math.sin(c.elapsed * (inRapid ? 9 : 2.5)) * (inRapid ? 0.12 : 0.05);
      const y = STREAM_WATER_Y + 0.1 + bob;
      const heading = Math.atan2(sm.dirX, sm.dirZ);
      deps.placePlayer(x, y + 0.15, z, heading);
      tube.position.set(x, y + 0.05, z);
      tube.rotation.z = c.elapsed * 0.4;
      for (const f of flowers) {
        const fp = streamSample(f.s);
        const fx = fp.x - fp.dirZ * f.off;
        const fz = fp.z + fp.dirX * f.off;
        f.mesh.position.set(fx, STREAM_WATER_Y + 0.08 + Math.sin(c.elapsed * 2 + f.s) * 0.04, fz);
        f.mesh.rotation.y = c.elapsed * 0.5 + f.s;
        if (!f.taken && Math.hypot(fx - x, fz - z) < 1.6) {
          f.taken = true;
          f.mesh.visible = false;
          a.score++;
          a.progress = a.score;
          deps.playRing();
          deps.burst(fx, y + 0.6, fz, '#f472b6');
        }
      }
      if (inRapid && Math.random() < c.dt * 3) deps.playSplash();
      if (a.tubeS >= Math.min(STREAM_LENGTH - 10, 470)) {
        finish([`ပန်း ${a.score}/${a.goal} ပွင့် ကောက်ရပါတယ်`, `ရေမျောချိန် ${fmtTime(a.t)}`]);
        return;
      }
    }
  };

  const hud = (): ActivityHud => {
    const a = active;
    let activeHud: ActivityHud['active'] = null;
    if (a) {
      const def = a.def;
      let stepMm = '';
      if (a.rings) stepMm = def.vehicle && def.vehicle === 'skyev' ? 'ကောင်းကင်ကွင်းကို ဖြတ်ပျံပါ (Space ⬆ / Q ⬇)' : 'အပြာရောင် ကွင်းကို ဖြတ်ပါ';
      if (def.id === 'manau_dance') stepMm = 'ကခုန်သူတွေနောက်က ကွင်းတွေကို လိုက်ပါ';
      if (def.kind === 'tickets') stepMm = 'ခရီးသည် တောင်းတဲ့ ဘူတာ လက်မှတ်ကို နှိပ်ပါ';
      if (def.kind === 'birthday') stepMm = a.birthdayChoice ? 'မြေပုံညွှန်အတိုင်း သင့်နေ့နံထောင့်ကို သွားပါ' : 'သင်မွေးတဲ့နေ့ကို ရွေးပါ';
      if (def.kind === 'tubing') stepMm = 'ဘယ်/ညာ (A/D သို့ joystick) နဲ့ ထိန်းပြီး ပန်းကောက်ပါ';
      const choice = a.birthdayChoice ? BIRTHDAY_POSTS.find((p) => p.id === a.birthdayChoice) : null;
      activeHud = {
        id: def.id,
        kind: def.kind,
        icon: def.icon,
        titleMm: def.titleMm,
        stepMm,
        progress: def.kind === 'tickets' ? a.score : a.progress,
        goal: a.goal,
        score: a.score,
        seconds: Math.floor(a.t),
        timeLeft: def.kind === 'tickets' ? Math.max(0, Math.ceil(TICKET_TIME - a.t)) : null,
        ticket:
          def.kind === 'tickets' && a.ticketQ
            ? {
                ...a.ticketQ,
                feedback: a.ticketFeedback && a.ticketFeedback.until > a.t ? a.ticketFeedback.kind : null,
              }
            : null,
        birthday:
          def.kind === 'birthday'
            ? {
                choosing: !a.birthdayChoice,
                options: BIRTHDAY_POSTS.map((p) => ({ id: p.id, labelMm: p.dayMm })),
                targetMm: choice ? `${choice.dayMm}နံ — ${choice.animalMm} · ${choice.dirMm}ထောင့်` : null,
              }
            : null,
      };
    }
    return {
      prompt: prompt ? { id: prompt.id, icon: prompt.icon, titleMm: prompt.titleMm, descMm: prompt.descMm } : null,
      active: activeHud,
      result,
      list: ACTIVITIES.map((d) => ({
        id: d.id,
        icon: d.icon,
        titleMm: d.titleMm,
        placeMm: d.placeMm,
        done: done.has(d.id),
        bestMm: best[d.id] === undefined ? null : d.scoring === 'time' ? fmtTime(best[d.id]) : `${best[d.id]} မှတ်`,
      })),
    };
  };

  /** Ticket or weekday button from the HUD. */
  const choose = (choiceId: string) => {
    const a = active;
    if (!a) return;
    if (a.def.kind === 'tickets' && a.ticketQ) {
      if (choiceId === a.ticketQ.destMm) {
        a.score++;
        a.ticketFeedback = { kind: 'ok', until: a.t + 0.6 };
        deps.playRing();
        if (a.score >= a.goal) {
          finish([`လက်မှတ် ${a.goal} စောင်လုံး မှန်ပါတယ်`, `ကြာချိန် ${fmtTime(a.t)}`]);
          return;
        }
        a.ticketQ = nextTicket();
      } else {
        a.ticketFeedback = { kind: 'wrong', until: a.t + 0.8 };
      }
    }
    if (a.def.kind === 'birthday' && !a.birthdayChoice) {
      a.birthdayChoice = choiceId;
      const p = BIRTHDAY_POSTS.find((b) => b.id === choiceId);
      if (p) deps.showBanner(`${p.dayMm}နံ — ${p.animalMm}`, `စေတီရဲ့ ${p.dirMm}ထောင့်ကို သွားပါ`);
    }
  };

  return {
    group: root,
    update,
    hud,
    choose,
    /** Start the activity whose marker the player stands on; true if one started */
    startNearby: () => {
      if (!prompt) return false;
      start(prompt.id, false);
      return true;
    },
    start: (id: ActivityId) => start(id, true),
    stop: () => {
      if (active) deps.showBanner(`${active.def.icon} ${active.def.titleMm}`, 'ရပ်လိုက်ပါပြီ');
      cleanup();
    },
    closeResult: () => {
      result = null;
    },
    isMovementLocked: () => Boolean(active && active.def.kind === 'tubing'),
    isActive: () => Boolean(active),
    /** Reset best scores (new game) */
    reset: () => {
      best = {};
      done = new Set();
      saveBest(best);
    },
  };
}
