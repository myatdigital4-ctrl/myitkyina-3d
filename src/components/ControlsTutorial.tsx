import React, { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
}

interface Step {
  title: string;
  icon: string;
  keyboard: [string, string][];
  touch: [string, string][];
}

const STEPS: Step[] = [
  {
    title: 'လမ်းလျှောက်ခြင်း · Moving around',
    icon: '🚶',
    keyboard: [
      ['W A S D / မြှားခလုတ်', 'ရှေ့/နောက်/ဘယ်/ညာ သွားရန်'],
      ['Shift', 'အပြေးမြန်ရန် (Sprint)'],
      ['Space', 'ခုန်ရန်'],
      ['Mouse ဆွဲ', 'ကင်မရာလှည့်ရန်'],
    ],
    touch: [
      ['ဘယ်ဘက် Joystick', 'လမ်းလျှောက်ရန် (အစွန်းထိတွန်းရင် ပြေးမည်)'],
      ['ညာဘက် မျက်နှာပြင် ပွတ်ဆွဲ', 'ကင်မရာလှည့်ရန်'],
      ['ခုန်ရန် ခလုတ်', 'ခုန်ရန် / ကားဘရိတ်'],
    ],
  },
  {
    title: 'ယာဉ်များ · Vehicles',
    icon: '🛵',
    keyboard: [
      ['F', 'အနီးရှိ ဆိုင်ကယ်/ကား/လှေ စီး/ဆင်း'],
      ['W / S', 'လီဗာ / နောက်ဆုတ်'],
      ['Space', 'ဘရိတ်'],
    ],
    touch: [
      ['ဆိုင်ကယ်/ကား [F]', 'ယာဉ်စီး/ဆင်း'],
      ['Joystick', 'မောင်းနှင်ရန်'],
    ],
  },
  {
    title: 'လုပ်ဆောင်ချက်များ · Actions',
    icon: '🙏',
    keyboard: [
      ['E', 'ဒေသခံနဲ့ စကားပြော၊ ဆိုင်မှာ နားရန်၊ ဘုရားမှာ ဆုတောင်းရန်'],
    ],
    touch: [
      ['စကားပြော [E]', 'လူ၊ ဆိုင်၊ ဘုရား အနီးတွင် နှိပ်ပါ'],
    ],
  },
  {
    title: 'မြေပုံနှင့် ကင်မရာ · Map & camera',
    icon: '🗺️',
    keyboard: [
      ['N', 'မြေပုံအကြီး ဖွင့်/ပိတ်'],
      ['J', 'ခရီးမှတ်တမ်း (တံဆိပ်နဲ့ postcard)'],
      ['Space / Q', 'ကချင်မိုးပျံ EV — အပေါ်ပျံ / အောက်ဆင်း'],
      ['P', 'ဓာတ်ပုံရိုက် (postcard)'],
      ['H', 'မီနူး (လည်ပတ်ရန်၊ အထင်ကရနေရာ၊ ယာဉ်၊ အချိန်)'],
      ['C', 'ကင်မရာ မုဒ်ပြောင်း'],
      ['R', 'ကင်မရာ နောက်ကျောသို့ ပြန်ချိန်'],
      ['M', 'အသံ ပိတ်/ဖွင့်'],
      ['Esc', 'ခေတ္တရပ် / ဆက်တင်'],
    ],
    touch: [
      ['Map ခလုတ်', 'မြေပုံအကြီး'],
      ['မီနူး', 'လည်ပတ်ရန်၊ အထင်ကရနေရာ၊ ယာဉ်'],
      ['⏸', 'ခေတ္တရပ်၊ သိမ်းဆည်း၊ ဆက်တင်'],
    ],
  },
  {
    title: 'ပန်းတိုင် · Goal',
    icon: '🌿',
    keyboard: [
      ['ဘယ်ဘက်အပေါ်', 'နောက်သွားရမယ့် အထင်ကရနေရာ နှင့် လမ်းညွှန်'],
      ['အချိန်မကန့်သတ်', 'အေးအေးဆေးဆေး လျှောက်ကြည့်ပါ — ရှုံးစရာ မရှိပါ'],
    ],
    touch: [
      ['မစ်ရှင်ကဒ်ကို နှိပ်', 'မစ်ရှင်နေရာသို့ အမြန်သွားရန်'],
      ['ဂိမ်း အလိုအလျောက်သိမ်း', 'ပိတ်ပြီး ပြန်ဖွင့်ရင် Continue နှိပ်ပါ'],
    ],
  },
];

export const ControlsTutorial: React.FC<Props> = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const isTouch =
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const [mode, setMode] = useState<'keyboard' | 'touch'>(isTouch ? 'touch' : 'keyboard');
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.code === 'ArrowRight' || e.code === 'Enter') {
        e.stopPropagation();
        if (last) onClose();
        else setStep((v) => v + 1);
      } else if (e.code === 'ArrowLeft') {
        e.stopPropagation();
        setStep((v) => Math.max(0, v - 1));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [last, onClose]);

  const rows = mode === 'keyboard' ? cur.keyboard : cur.touch;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 pointer-events-auto overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Controls guide"
    >
      <div className="w-full max-w-md my-auto rounded-xl bg-[#0d171c] border border-white/15 p-4 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-slate-400">
            ကစားနည်း · How to play — {step + 1}/{STEPS.length}
          </span>
          <div className="flex rounded-lg overflow-hidden border border-white/15 text-[11px]">
            {(['keyboard', 'touch'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 cursor-pointer ${
                  mode === m ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {m === 'keyboard' ? '⌨ Keyboard' : '📱 Touch'}
              </button>
            ))}
          </div>
        </div>

        <h2 className="text-base font-bold font-display mb-2">
          <span className="mr-1.5">{cur.icon}</span>
          {cur.title}
        </h2>

        <div className="space-y-1.5 mb-3 min-h-[150px]">
          {rows.map(([k, d]) => (
            <div
              key={k}
              className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-white/10 text-xs"
            >
              <kbd className="shrink-0 px-1.5 py-0.5 rounded bg-slate-700 border border-white/20 font-mono text-[11px] text-emerald-200">
                {k}
              </kbd>
              <span className="text-slate-200 leading-relaxed">{d}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              aria-label={`Step ${i + 1}`}
              className={`h-2 rounded-full cursor-pointer transition-all ${
                i === step ? 'w-5 bg-emerald-400' : 'w-2 bg-slate-600'
              }`}
            />
          ))}
        </div>

        <div className="flex justify-between gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            ကျော်မည် · Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/15 rounded-lg text-xs cursor-pointer"
              >
                ← နောက်
              </button>
            )}
            <button
              onClick={() => (last ? onClose() : setStep(step + 1))}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white cursor-pointer"
            >
              {last ? 'စကစားမည် · Play!' : 'ရှေ့ →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
