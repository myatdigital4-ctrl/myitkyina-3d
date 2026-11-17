import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { HUDState } from '../types/game';
import { deletePostcard, loadPostcards, POSTCARDS_EVENT, type Postcard } from '../journal/journal';

type Journal = HUDState['journal'];

function Stamp({ icon, ink, found, size = 64 }: { icon: string; ink: string; found: boolean; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center"
      style={{
        width: size,
        height: size,
        border: `3px ${found ? 'solid' : 'dashed'} ${found ? ink : '#a8a29e'}`,
        boxShadow: found ? `inset 0 0 0 3px #f6f0e2, inset 0 0 0 5px ${ink}` : undefined,
        background: found ? '#fbf6ea' : '#e7e2d6',
        transform: found ? 'rotate(-8deg)' : undefined,
        fontSize: size * 0.42,
        filter: found ? undefined : 'grayscale(1) opacity(0.35)',
      }}
      aria-hidden="true"
    >
      {found ? icon : '?'}
    </div>
  );
}

/** Card shown the first time the player reaches a landmark. */
export function DiscoveryCard({
  card,
  onClose,
  onPhoto,
}: {
  card: NonNullable<Journal['card']>;
  onClose: () => void;
  onPhoto: () => void;
}) {
  return createPortal(
    <div className="fixed inset-x-0 bottom-24 z-[80] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-[#f6f0e2] text-[#3a2f25] shadow-2xl border border-[#d9ccb4] p-4 animate-[fadeIn_.4s_ease-out]">
        <div className="flex items-center gap-3">
          <Stamp icon={card.icon} ink={card.ink} found size={58} />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold tracking-wide uppercase text-[#8a7a66]">
              ခရီးမှတ်တမ်း တံဆိပ်အသစ် · {card.found}/{card.total}
            </div>
            <div className="text-lg font-extrabold leading-tight">{card.nameMm}</div>
            <div className="text-[11px] text-[#7a6a58]">{card.nameEn}</div>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed">
          {card.factsMm.map((f) => (
            <li key={f} className="flex gap-2">
              <span style={{ color: card.ink }}>•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <button
            onClick={onPhoto}
            className="flex-1 py-2 rounded-lg bg-[#3a2f25] text-[#f6f0e2] text-[13px] font-bold cursor-pointer"
          >
            📷 ဓာတ်ပုံရိုက်မယ်
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-[#3a2f25]/30 text-[13px] font-bold cursor-pointer"
          >
            ဆက်လျှောက်မယ်
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Full travel journal: stamps for each landmark and the postcards taken in photo mode. */
export function JournalPanel({ journal, onClose }: { journal: Journal; onClose: () => void }) {
  const [postcards, setPostcards] = useState<Postcard[]>(() => loadPostcards());
  const [open, setOpen] = useState<Postcard | null>(null);
  useEffect(() => {
    const refresh = () => setPostcards(loadPostcards());
    window.addEventListener(POSTCARDS_EVENT, refresh);
    return () => window.removeEventListener(POSTCARDS_EVENT, refresh);
  }, []);
  const found = journal.stamps.filter((s) => s.found).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#f6f0e2] text-[#3a2f25] shadow-2xl p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-extrabold">📔 ခရီးမှတ်တမ်း</div>
            <div className="text-[12px] text-[#7a6a58]">
              အထင်ကရနေရာ {found}/{journal.stamps.length} · Postcard {postcards.length}
            </div>
          </div>
          <button onClick={onClose} className="px-2 py-1 text-[#7a6a58] text-lg cursor-pointer" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {journal.stamps.map((s) => (
            <div key={s.id} className="rounded-xl border border-[#e2d6c0] bg-white/50 p-3">
              <div className="flex items-center gap-2.5">
                <Stamp icon={s.icon} ink={s.ink} found={s.found} size={48} />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold leading-tight">{s.found ? s.nameMm : 'မတွေ့ရသေး'}</div>
                  <div className="text-[10px] text-[#8a7a66] truncate">{s.found ? s.nameEn : 'လျှောက်ရှာကြည့်ပါ'}</div>
                </div>
              </div>
              {s.found && <p className="mt-2 text-[11px] leading-relaxed text-[#5a4c3e]">{s.factsMm[0]}</p>}
              <div className={`mt-2 text-[10px] font-semibold ${s.aerial ? 'text-sky-700' : 'text-[#a8a29e]'}`}>
                {s.aerial ? '✈ ကောင်းကင်ကနေ မြင်ပြီး ✓' : '✈ ကချင်မိုးပျံ EV နဲ့ အပေါ်ကနေ ကြည့်ပါ'}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#8a7a66]">နောက် update တွေမှာ နေရာအသစ်နဲ့ တံဆိပ်အသစ်တွေ ထပ်တိုးပါမယ်။</p>

        <div className="mt-5 text-[14px] font-bold">Postcards</div>
        {postcards.length === 0 ? (
          <p className="mt-1 text-[12px] text-[#7a6a58]">
            အပေါ်က 📷 ကိုနှိပ်ပြီး လှတဲ့နေရာမှာ ပုံရိုက်ပါ။ နေဝင်ချိန်မှာ ရိုက်ရင် ပိုလှပါတယ်။
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {postcards.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpen(p)}
                className="text-left rounded-lg overflow-hidden bg-white shadow cursor-pointer"
              >
                <img src={p.dataUrl} alt={`${p.placeMm} postcard`} className="w-full aspect-[16/10] object-cover" />
                <div className="px-2 py-1 text-[10px] text-[#5a4c3e] truncate">
                  {p.placeMm} · {p.timeMm}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex flex-col items-center justify-center p-3 gap-3" onClick={(e) => { e.stopPropagation(); setOpen(null); }}>
          <img src={open.dataUrl} alt={`${open.placeMm} postcard`} className="max-w-full max-h-[78vh] rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <a
              href={open.dataUrl}
              download={`myitkyina-${open.id}.jpg`}
              className="px-4 py-2 rounded-lg bg-[#f6f0e2] text-[#3a2f25] text-[13px] font-bold"
            >
              ⬇ သိမ်းမယ်
            </a>
            <button
              onClick={() => {
                deletePostcard(open.id);
                setOpen(null);
              }}
              className="px-4 py-2 rounded-lg border border-white/40 text-white text-[13px] font-bold cursor-pointer"
            >
              ဖျက်မယ်
            </button>
            <button onClick={() => setOpen(null)} className="px-4 py-2 rounded-lg text-white/80 text-[13px] cursor-pointer">
              ပိတ်မယ်
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
