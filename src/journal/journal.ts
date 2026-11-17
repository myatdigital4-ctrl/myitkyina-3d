/**
 * Travel journal (ခရီးမှတ်တမ်း): stamps for landmarks you have found, with a short fact card,
 * and postcards you took in photo mode. Stored in this browser (localStorage).
 */
import { STATION } from '../world/railwayStation';
import { SUTAUNGPYAE } from '../world/sutaungpyae';
import { AUNG_MYIN_THAR } from '../world/aungMyinThar';

export interface JournalPlace {
  id: string;
  nameMm: string;
  nameEn: string;
  /** Stamp colors */
  ink: string;
  icon: string;
  x: number;
  z: number;
  /** Discovered when the player comes within this many meters */
  radius: number;
  factsMm: string[];
}

/** Landmarks rebuilt from Google Maps. New landmarks add a stamp here. */
export const JOURNAL_PLACES: JournalPlace[] = [
  {
    id: 'railway_station',
    nameMm: 'မြစ်ကြီးနား ဘူတာကြီး',
    nameEn: 'Myitkyina Railway Station',
    ink: '#1d4ed8',
    icon: '🚆',
    x: STATION.x,
    z: STATION.z,
    radius: 48,
    factsMm: [
      'မန္တလေး–မြစ်ကြီးနား ရထားလမ်းရဲ့ မြောက်ဘက်အဆုံး ဘူတာကြီးပါ။',
      'မန္တလေးကနေ ရထားနဲ့ ကီလိုမီတာ ၅၀၀ ကျော် ခရီးနှင်ရပါတယ်။',
      'ဘူတာရှေ့ကလမ်းက သခင်နက်ဖေလမ်း ဖြစ်ပါတယ်။',
    ],
  },
  {
    id: 'manau_park',
    nameMm: 'မနောကွင်း',
    nameEn: 'Kachin National Manau Park',
    ink: '#b91c1c',
    icon: '🪶',
    x: 0,
    z: 0,
    radius: 55,
    factsMm: [
      'ကချင်ရိုးရာ မနောပွဲတော်ကို ဒီကွင်းမှာ နှစ်စဉ် ကျင်းပပါတယ်။',
      'အလယ်က မနောတိုင် (ရှဒုင်) တွေပေါ်က ပုံစံတွေက ကချင်လူမျိုးတို့ရဲ့ သမိုင်းနဲ့ ယုံကြည်ချက်တွေကို ဖော်ပြပါတယ်။',
      'မနောပွဲမှာ လူအများအပြား မနောတိုင်ကို ပတ်ပြီး စက်ဝိုင်းပုံ လိုက်ကကြပါတယ်။',
    ],
  },
  {
    id: 'sutaungpyae',
    nameMm: 'ဆုတောင်းပြည့်ဘုရား',
    nameEn: 'Sutaungpyae Pagoda',
    ink: '#b45309',
    icon: '🛕',
    x: SUTAUNGPYAE.x,
    z: SUTAUNGPYAE.z,
    radius: 42,
    factsMm: [
      '"ဆုတောင်းပြည့်" ဆိုတာ ဆုတောင်းသမျှ ပြည့်စေတဲ့ ဘုရား လို့ အဓိပ္ပါယ်ရပါတယ်။',
      'ဧရာဝတီမြစ်ကမ်းနဲ့ နီးတဲ့ မြစ်ကြီးနားရဲ့ လူသိများတဲ့ ဘုရားတစ်ဆူပါ။',
      'ဝင်းထဲမှာ လျောင်းတော်မူဘုရားနဲ့ ရပ်တော်မူဘုရားတို့လည်း ရှိပါတယ်။',
    ],
  },
  {
    id: 'aung_myin_thar',
    nameMm: 'အောင်မြင်သာ အပန်းဖြေစခန်း',
    nameEn: 'Aung Myin Thar Recreation Area',
    ink: '#0f766e',
    icon: '🏞️',
    x: AUNG_MYIN_THAR.x,
    z: AUNG_MYIN_THAR.z,
    radius: 120,
    factsMm: [
      'မြစ်ကြီးနား–မြစ်ဆုံ လမ်းပေါ်မှာ ရှိတဲ့ ချောင်းရေကြည် အပန်းဖြေစခန်းပါ။',
      'ကျောက်တုံးကြီးတွေကြား စီးနေတဲ့ ရေကြည်ထဲမှာ ရေဆော့ကြ၊ ကွင်းစီးကြပါတယ်။',
      'ချောင်းနံဘေးမှာ သက်ကယ်မိုး တဲလေးတွေ၊ မုန့်ဆိုင်တွေနဲ့ ဝါးရုံတွေ ရှိပါတယ်။',
    ],
  },
];

export interface JournalCard {
  placeId: string;
  nameMm: string;
  nameEn: string;
  icon: string;
  ink: string;
  factsMm: string[];
  found: number;
  total: number;
}

export interface Postcard {
  id: string;
  placeMm: string;
  timeMm: string;
  takenAt: number;
  dataUrl: string;
}

const STAMPS_KEY = 'myitkyina-journal-stamps-v1';
const POSTCARDS_KEY = 'myitkyina-postcards-v1';
const MAX_POSTCARDS = 12;
export const POSTCARDS_EVENT = 'myitkyina-postcards-changed';

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export function loadStamps(): string[] {
  try {
    const raw = storage()?.getItem(STAMPS_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export function saveStamps(stamps: string[]) {
  try {
    storage()?.setItem(STAMPS_KEY, JSON.stringify(stamps));
  } catch {
    /* storage full or blocked: the stamp still shows this session */
  }
}

export function loadPostcards(): Postcard[] {
  try {
    const raw = storage()?.getItem(POSTCARDS_KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** Newest first; drops the oldest when full. Returns false if the browser refused to store it. */
export function addPostcard(card: Postcard): boolean {
  const list = [card, ...loadPostcards()].slice(0, MAX_POSTCARDS);
  let ok = false;
  // If storage is full, retry with fewer cards
  for (let n = list.length; n > 0 && !ok; n--) {
    try {
      storage()?.setItem(POSTCARDS_KEY, JSON.stringify(list.slice(0, n)));
      ok = true;
    } catch {
      ok = false;
    }
  }
  window.dispatchEvent(new Event(POSTCARDS_EVENT));
  return ok;
}

export function deletePostcard(id: string) {
  try {
    storage()?.setItem(POSTCARDS_KEY, JSON.stringify(loadPostcards().filter((p) => p.id !== id)));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(POSTCARDS_EVENT));
}

export function nearestPlace(x: number, z: number, within = 140): JournalPlace | null {
  let best: JournalPlace | null = null;
  let bestD = within;
  for (const p of JOURNAL_PLACES) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Turn the freshly rendered WebGL canvas into a postcard: scaled to 960 px wide with a cream
 * frame and a caption strip (place · time of day · date).
 */
export function composePostcard(source: HTMLCanvasElement, placeMm: string, timeMm: string): string {
  const W = 960;
  const scale = W / source.width;
  const H = Math.round(source.height * scale);
  const pad = 22;
  const strip = 70;
  const c = document.createElement('canvas');
  c.width = W + pad * 2;
  c.height = H + pad + strip;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f0e2';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(source, pad, pad, W, H);
  g.fillStyle = '#3a2f25';
  g.font = 'bold 30px "Noto Sans Myanmar", "Myanmar Text", Padauk, "Myanmar Sangam MN", sans-serif';
  g.textBaseline = 'middle';
  g.fillText(`မြစ်ကြီးနား · ${placeMm}`, pad, H + pad + strip / 2);
  g.font = '20px "Noto Sans Myanmar", "Myanmar Text", Padauk, sans-serif';
  g.fillStyle = '#7a6a58';
  g.textAlign = 'right';
  const d = new Date();
  g.fillText(`${timeMm} · ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`, c.width - pad, H + pad + strip / 2);
  return c.toDataURL('image/jpeg', 0.82);
}
