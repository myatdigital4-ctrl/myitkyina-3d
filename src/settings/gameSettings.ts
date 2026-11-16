/**
 * Per-device player settings (graphics, audio, camera), stored in localStorage.
 * Changes are broadcast with a window event so the 3D canvas and sound engine
 * can apply them live without a reload.
 */

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface GameSettings {
  graphicsQuality: GraphicsQuality;
  /** 0..1 */
  musicVolume: number;
  /** 0..1 */
  sfxVolume: number;
  /** 0.4..2.0 multiplier on drag-to-look speed */
  cameraSensitivity: number;
  invertCameraY: boolean;
  showFps: boolean;
  tutorialSeen: boolean;
}

const STORAGE_KEY = 'myitkyina3d_settings_v1';
export const SETTINGS_CHANGED_EVENT = 'myitkyina-settings-changed';

function detectDefaultQuality(): GraphicsQuality {
  if (typeof window === 'undefined') return 'medium';
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem !== undefined && mem <= 3) return 'low';
  return isTouch ? 'medium' : 'high';
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphicsQuality: detectDefaultQuality(),
  musicVolume: 0.7,
  sfxVolume: 0.85,
  cameraSensitivity: 1,
  invertCameraY: false,
  showFps: false,
  tutorialSeen: false,
};

let current: GameSettings = load();

function load(): GameSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if (!['low', 'medium', 'high'].includes(merged.graphicsQuality)) {
      merged.graphicsQuality = DEFAULT_SETTINGS.graphicsQuality;
    }
    merged.musicVolume = clamp(Number(merged.musicVolume), 0, 1, DEFAULT_SETTINGS.musicVolume);
    merged.sfxVolume = clamp(Number(merged.sfxVolume), 0, 1, DEFAULT_SETTINGS.sfxVolume);
    merged.cameraSensitivity = clamp(Number(merged.cameraSensitivity), 0.4, 2, 1);
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function getSettings(): GameSettings {
  return current;
}

export function updateSettings(patch: Partial<GameSettings>): GameSettings {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable (private mode) — settings still apply for this session.
  }
  window.dispatchEvent(new CustomEvent<GameSettings>(SETTINGS_CHANGED_EVENT, { detail: current }));
  return current;
}

export function onSettingsChanged(cb: (s: GameSettings) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<GameSettings>).detail);
  window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
  return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
}

export interface QualityProfile {
  maxPixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  /** Camera far plane in meters */
  viewDistance: number;
  /** Minimum exponential fog density, so the shorter far plane fades out instead of popping */
  minFogDensity: number;
}

export const QUALITY_PROFILES: Record<GraphicsQuality, QualityProfile> = {
  low: {
    maxPixelRatio: 1,
    shadows: false,
    shadowMapSize: 1024,
    antialias: false,
    viewDistance: 900,
    minFogDensity: 0.0019,
  },
  medium: {
    maxPixelRatio: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    viewDistance: 1800,
    minFogDensity: 0.00096,
  },
  high: {
    maxPixelRatio: 2,
    shadows: true,
    shadowMapSize: 2048,
    antialias: true,
    viewDistance: 3500,
    minFogDensity: 0,
  },
};

export const QUALITY_LABELS: Record<GraphicsQuality, string> = {
  low: 'နိမ့် (Low) — ဖုန်းဟောင်းများအတွက်',
  medium: 'အလယ် (Medium)',
  high: 'မြင့် (High) — ကွန်ပျူတာ/ဖုန်းကောင်း',
};
