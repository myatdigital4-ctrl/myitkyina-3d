/**
 * Myitkyina 3D — Local Save System (localStorage)
 * ဂိမ်းတိုးတက်မှုကို ဖုန်း/ကွန်ပျူတာ browser ထဲတွင် အလိုအလျောက် သိမ်းဆည်းသည်။
 */
import type {
  FishCatchInfo,
  FishingRodLevel,
  QuestObjective,
  TimeOfDay,
  WeatherMode,
} from '../types/game';

export const SAVE_KEY = 'myitkyina-emerald-save-v1';
export const SAVE_VERSION = 1;
export const AUTOSAVE_INTERVAL_MS = 30_000;

export interface SavedQuestProgress {
  id: string;
  progress: number;
  completed: boolean;
}

export interface GameSaveData {
  version: number;
  savedAt: number; // epoch ms
  moneyMmk: number;
  score: number;
  meritLevel: number;
  health: number;
  player: { x: number; z: number; heading: number };
  quests: SavedQuestProgress[];
  world: {
    drumsActivated: boolean[];
    bridgeCheckpointsPassed: boolean[];
    enemiesAlive: boolean[];
    peaceBellRung: boolean;
    timeOfDay: TimeOfDay;
    weather: WeatherMode;
  };
  fishing: {
    rodLevel: FishingRodLevel;
    totalCaught: number;
    totalSold: number;
    totalEarnedMmk: number;
    biggestKg: number;
    basket: FishCatchInfo[];
    caughtSpecies: string[];
  };
}

/** Title screen အတွက် အကျဉ်းချုပ် */
export interface SaveSummary {
  savedAt: number;
  moneyMmk: number;
  questsCompleted: number;
  questsTotal: number;
}

const storage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // Private mode / storage blocked
  }
};

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isValidSave(d: any): d is GameSaveData {
  return (
    !!d &&
    d.version === SAVE_VERSION &&
    isFiniteNum(d.moneyMmk) &&
    !!d.player &&
    isFiniteNum(d.player.x) &&
    isFiniteNum(d.player.z) &&
    Array.isArray(d.quests) &&
    !!d.world &&
    !!d.fishing
  );
}

export function saveGame(data: GameSaveData): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // Quota exceeded etc.
  }
}

export function loadGame(): GameSaveData | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidSave(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    storage()?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function getSaveSummary(): SaveSummary | null {
  const d = loadGame();
  if (!d) return null;
  return {
    savedAt: d.savedAt,
    moneyMmk: d.moneyMmk,
    questsCompleted: d.quests.filter((q) => q.completed).length,
    questsTotal: d.quests.length,
  };
}

/** Saved quest progress ကို လက်ရှိ quest စာရင်းပေါ် ပေါင်းထည့်သည် (နောက်မှထည့်သော quest အသစ်များ ပျက်မသွားစေရန်) */
export function mergeQuestProgress(
  base: QuestObjective[],
  saved: SavedQuestProgress[],
): QuestObjective[] {
  const byId = new Map(saved.map((q) => [q.id, q]));
  return base.map((q) => {
    const s = byId.get(q.id);
    if (!s) return { ...q };
    return {
      ...q,
      progress: Math.max(0, Math.min(q.goal, Number(s.progress) || 0)),
      completed: !!s.completed,
    };
  });
}

/** "၅ မိနစ်အကြာ" ပုံစံ မြန်မာစာ */
export function formatSavedAgoMm(savedAt: number, now = Date.now()): string {
  const mmDigits = (n: number) =>
    String(n).replace(/\d/g, (d) => '၀၁၂၃၄၅၆၇၈၉'[Number(d)]);
  const sec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (sec < 60) return 'ယခုလေးတင်';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${mmDigits(min)} မိနစ်အကြာ`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${mmDigits(hr)} နာရီအကြာ`;
  return `${mmDigits(Math.floor(hr / 24))} ရက်အကြာ`;
}
