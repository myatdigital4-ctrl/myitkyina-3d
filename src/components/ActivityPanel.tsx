import React from 'react';
import { createPortal } from 'react-dom';
import type { ActivityHud, ActivityId } from '../activities/activities';

interface Ctl {
  startActivity: (id: ActivityId) => void;
  stopActivity: () => void;
  activityChoose: (choiceId: string) => void;
  closeActivityResult: () => void;
}

const paper = 'bg-[#f6f0e2] text-[#3a2f25] border border-[#d9ccb4] shadow-2xl';

/** On-screen parts of the landmark activities: start prompt, progress bar, mini-game cards, result. */
export function ActivityPanel({ activity, ctl }: { activity: ActivityHud; ctl: Ctl | null }) {
  const { prompt, active, result } = activity;
  // Rendered into <body> so no other HUD layer (e.g. the full map) can sit on top and swallow taps
  return createPortal(
    <>
      {/* Start prompt at a marker */}
      {prompt && !active && !result && (
        <div className="fixed inset-x-0 bottom-24 z-[80] flex justify-center px-3 pointer-events-none">
          <div className={`pointer-events-auto w-full max-w-sm rounded-2xl p-3 ${paper}`}>
            <div className="text-[15px] font-extrabold">
              {prompt.icon} {prompt.titleMm}
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-[#5a4c3e]">{prompt.descMm}</p>
            <button
              onClick={() => ctl?.startActivity(prompt.id)}
              className="mt-2 w-full py-2 rounded-lg bg-[#3a2f25] text-[#f6f0e2] text-[13px] font-bold cursor-pointer"
            >
              ▶ စတင်မယ် [E]
            </button>
          </div>
        </div>
      )}

      {/* Progress bar while playing */}
      {active && (
        <div className="fixed top-14 inset-x-0 z-[80] flex justify-center px-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/60 backdrop-blur px-4 py-1.5 text-white shadow-lg">
            <span className="text-[13px] font-bold whitespace-nowrap">
              {active.icon} {active.titleMm}
            </span>
            <span className="text-[11px] text-white/75 hidden sm:inline">{active.stepMm}</span>
            <span className="text-[12px] font-mono-tabular font-bold text-amber-200">
              {active.progress}/{active.goal}
            </span>
            <span className="text-[12px] font-mono-tabular text-sky-200">
              {active.timeLeft !== null ? `⏱ ${active.timeLeft}s` : `${Math.floor(active.seconds / 60)}:${String(active.seconds % 60).padStart(2, '0')}`}
            </span>
            <button onClick={() => ctl?.stopActivity()} className="text-[11px] text-white/70 hover:text-white cursor-pointer" aria-label="Stop">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Ticket counter mini-game */}
      {active?.ticket && (
        <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-3 pointer-events-none">
          <div
            className={`pointer-events-auto w-full max-w-md rounded-2xl p-4 ${paper} ${
              active.ticket.feedback === 'ok' ? 'ring-4 ring-emerald-400' : active.ticket.feedback === 'wrong' ? 'ring-4 ring-rose-400' : ''
            }`}
          >
            <div className="text-[12px] text-[#7a6a58]">🧳 {active.ticket.passengerMm} က ပြောတယ် —</div>
            <div className="text-[18px] font-extrabold">"{active.ticket.destMm} ကို လက်မှတ် တစ်စောင် ပေးပါ"</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {active.ticket.options.map((o) => (
                <button
                  key={o}
                  onClick={() => ctl?.activityChoose(o)}
                  className="relative py-3 rounded-lg bg-[#fffaf0] border-2 border-dashed border-[#b45309] text-[15px] font-bold text-[#7c2d12] cursor-pointer active:scale-95 transition-transform"
                >
                  🎫 {o}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-[#8a7a66]">
              {active.ticket.feedback === 'wrong' ? 'မဟုတ်သေးဘူး — ထပ်ကြည့်ပါ' : 'မန္တလေး–မြစ်ကြီးနား ရထားလမ်းပေါ်က ဘူတာတွေပါ'}
            </div>
          </div>
        </div>
      )}

      {/* Birthday corner: pick a weekday */}
      {active?.birthday && (
        <div className="fixed inset-x-0 bottom-20 z-[80] flex justify-center px-3 pointer-events-none">
          <div className={`pointer-events-auto w-full max-w-md rounded-2xl p-4 ${paper}`}>
            {active.birthday.choosing ? (
              <>
                <div className="text-[15px] font-extrabold">သင် ဘာနေ့ မွေးလဲ?</div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {active.birthday.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => ctl?.activityChoose(o.id)}
                      className="py-2 rounded-lg bg-white border border-[#d9ccb4] text-[12px] font-bold cursor-pointer active:scale-95"
                    >
                      {o.labelMm}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-[13px]">
                🧭 <span className="font-bold">{active.birthday.targetMm}</span> ကို ရှာပါ — စေတီပတ်လည်မှာ ရှိတဲ့ နေ့နံထောင့်တွေကို ကြည့်ပါ
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="fixed inset-0 z-[90] bg-black/45 flex items-center justify-center p-3">
          <div className={`w-full max-w-sm rounded-2xl p-5 text-center ${paper}`}>
            <div className="text-4xl">{result.icon}</div>
            <div className="mt-1 text-lg font-extrabold">{result.titleMm}</div>
            {result.newBest && (
              <div className="mt-1 inline-block rounded-full bg-amber-400 px-3 py-0.5 text-[11px] font-bold text-amber-950">
                ★ မှတ်တမ်းသစ်
              </div>
            )}
            <ul className="mt-3 space-y-1 text-[13px]">
              {result.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            {result.bestMm && <div className="mt-2 text-[12px] text-[#7a6a58]">{result.bestMm}</div>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => ctl?.startActivity(result.id)}
                className="flex-1 py-2 rounded-lg bg-[#3a2f25] text-[#f6f0e2] text-[13px] font-bold cursor-pointer"
              >
                ↻ ထပ်ကစားမယ်
              </button>
              <button
                onClick={() => ctl?.closeActivityResult()}
                className="flex-1 py-2 rounded-lg border border-[#3a2f25]/30 text-[13px] font-bold cursor-pointer"
              >
                ဆက်လျှောက်မယ်
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

/** Menu list of every activity with its best result. */
export function ActivityList({ activity, ctl, onPick }: { activity: ActivityHud; ctl: Ctl | null; onPick: () => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {activity.list.map((a) => (
        <button
          key={a.id}
          onClick={() => {
            ctl?.startActivity(a.id);
            onPick();
          }}
          className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-white/10 hover:border-amber-300 text-left cursor-pointer"
        >
          <span className="text-xl">{a.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-amber-100 truncate">{a.titleMm}</span>
            <span className="block text-[10px] text-slate-400 truncate">{a.placeMm}</span>
          </span>
          <span className="text-[10px] text-emerald-300 whitespace-nowrap">{a.done ? `✓ ${a.bestMm ?? ''}` : ''}</span>
        </button>
      ))}
    </div>
  );
}
