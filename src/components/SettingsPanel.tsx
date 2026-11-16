import React, { useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  GameSettings,
  GraphicsQuality,
  QUALITY_LABELS,
  getSettings,
  onSettingsChanged,
  updateSettings,
} from '../settings/gameSettings';

interface Props {
  onClose: () => void;
}

const QUALITY_ORDER: GraphicsQuality[] = ['low', 'medium', 'high'];

export const SettingsPanel: React.FC<Props> = ({ onClose }) => {
  const [s, setS] = useState<GameSettings>(() => getSettings());
  const [initialQuality] = useState<GraphicsQuality>(() => getSettings().graphicsQuality);

  useEffect(() => onSettingsChanged(setS), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const set = (patch: Partial<GameSettings>) => updateSettings(patch);
  // Anti-aliasing is fixed when the WebGL context is created
  const needsReloadForAA =
    (initialQuality === 'low') !== (s.graphicsQuality === 'low');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 pointer-events-auto overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md my-auto rounded-xl bg-[#0d171c] border border-white/15 p-4 shadow-2xl text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold font-display">⚙ ဆက်တင်များ · Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/15 text-sm cursor-pointer"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <section className="mb-4">
          <h3 className="text-xs font-semibold text-emerald-300 mb-1.5">ဂရပ်ဖစ် · Graphics</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {QUALITY_ORDER.map((q) => (
              <button
                key={q}
                onClick={() => set({ graphicsQuality: q })}
                className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  s.graphicsQuality === q
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-slate-800 border-white/15 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {q === 'low' ? 'Low' : q === 'medium' ? 'Medium' : 'High'}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">{QUALITY_LABELS[s.graphicsQuality]}</p>
          <p className="text-[11px] text-slate-400">
            ဖုန်းပူလာရင် (သို့) နှေးနေရင် Low ကိုရွေးပါ — အရိပ်ပိတ်၊ မြင်ကွင်းအကွာအဝေး လျှော့ပါမည်။
          </p>
          {needsReloadForAA && (
            <button
              onClick={() => window.location.reload()}
              className="mt-1.5 text-[11px] text-amber-300 underline cursor-pointer"
            >
              အနားသတ်ချောမွေ့မှု (anti-aliasing) ပြောင်းရန် စာမျက်နှာ ပြန်ဖွင့်ပါ (ဂိမ်း autosave ရှိပါသည်)
            </button>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={s.showFps}
              onChange={(e) => set({ showFps: e.target.checked })}
              className="w-4 h-4 accent-emerald-500"
            />
            FPS ပြမည် · Show FPS
          </label>
        </section>

        <section className="mb-4">
          <h3 className="text-xs font-semibold text-emerald-300 mb-1.5">အသံ · Audio</h3>
          <Slider
            label="သီချင်း · Music"
            value={s.musicVolume}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ musicVolume: v })}
          />
          <Slider
            label="အသံထွက် · Sound effects"
            value={s.sfxVolume}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ sfxVolume: v })}
          />
        </section>

        <section className="mb-4">
          <h3 className="text-xs font-semibold text-emerald-300 mb-1.5">ကင်မရာ · Camera</h3>
          <Slider
            label="လှည့်နှုန်း · Look sensitivity"
            value={s.cameraSensitivity}
            min={0.4}
            max={2}
            step={0.1}
            format={(v) => `${v.toFixed(1)}x`}
            onChange={(v) => set({ cameraSensitivity: v })}
          />
          <label className="mt-1 flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={s.invertCameraY}
              onChange={(e) => set({ invertCameraY: e.target.checked })}
              className="w-4 h-4 accent-emerald-500"
            />
            အပေါ်/အောက် ပြောင်းပြန် · Invert vertical look
          </label>
        </section>

        <div className="flex justify-between gap-2">
          <button
            onClick={() =>
              set({
                graphicsQuality: DEFAULT_SETTINGS.graphicsQuality,
                musicVolume: DEFAULT_SETTINGS.musicVolume,
                sfxVolume: DEFAULT_SETTINGS.sfxVolume,
                cameraSensitivity: DEFAULT_SETTINGS.cameraSensitivity,
                invertCameraY: false,
                showFps: false,
              })
            }
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/15 rounded-lg text-xs cursor-pointer"
          >
            မူလအတိုင်း · Reset
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white cursor-pointer"
          >
            ပြီးပြီ · Done
          </button>
        </div>
      </div>
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, format, onChange }) => (
  <label className="block mb-2">
    <span className="flex justify-between text-xs mb-0.5">
      <span>{label}</span>
      <span className="font-mono text-emerald-300">{format(value)}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-6 accent-emerald-500 cursor-pointer"
    />
  </label>
);
