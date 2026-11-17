/**
 * V2 HUD pieces in a clean mobile-game style: glassy rounded panels, a clock with the time of
 * day, a compass strip, square icon buttons, a speed / altitude panel and round touch buttons
 * for driving and flying.
 */
import React from 'react';
import type { TimeOfDay, VehicleType } from '../types/game';

export const glass = 'bg-slate-900/45 backdrop-blur-md border border-white/25 text-white shadow-lg';

const TOD: Record<TimeOfDay, { base: number; icon: string; labelMm: string }> = {
  morning: { base: 7 * 60 + 20, icon: '🌤', labelMm: 'မနက်ခင်း' },
  noon: { base: 13 * 60 + 25, icon: '☀️', labelMm: 'နေ့လယ်' },
  sunset: { base: 17 * 60 + 45, icon: '🌇', labelMm: 'နေဝင်ချိန်' },
  night: { base: 21 * 60 + 5, icon: '🌙', labelMm: 'ည' },
};
const pageStart = Date.now();

/** "13:25 ☀ နေ့လယ်" — the clock ticks one game minute per real 10 seconds within the time of day. */
export function ClockWidget({ tod, region }: { tod: TimeOfDay; region: string }) {
  const t = TOD[tod];
  const mins = t.base + Math.floor((Date.now() - pageStart) / 10000) % 50;
  const hh = String(Math.floor(mins / 60) % 24).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return (
    <div className={`rounded-xl px-3 py-1.5 ${glass}`}>
      <div className="flex items-center gap-2 text-[15px] font-bold leading-none">
        <span className="font-mono-tabular">
          {hh}:{mm}
        </span>
        <span>{t.icon}</span>
        <span className="text-[13px]">{t.labelMm}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-white/75 truncate max-w-[180px]">{region}</div>
    </div>
  );
}

/** Compass strip: degrees every 15°, letters at the cardinal points; center = where the camera looks. */
export function CompassStrip({ cameraYaw }: { cameraYaw: number }) {
  // camera looks along (sin yaw, cos yaw) in world x/z; north is −z, east is +x
  const bearing = ((Math.atan2(Math.sin(cameraYaw), -Math.cos(cameraYaw)) * 180) / Math.PI + 360) % 360;
  const span = 70;
  const ticks: { deg: number; offset: number }[] = [];
  const startDeg = Math.ceil((bearing - span) / 15) * 15;
  for (let d = startDeg; d <= bearing + span; d += 15) ticks.push({ deg: ((d % 360) + 360) % 360, offset: d - bearing });
  const label = (d: number) => ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' } as Record<number, string>)[d];
  return (
    <div className="relative w-[300px] max-w-[46vw] h-9 overflow-hidden rounded-lg bg-gradient-to-b from-slate-900/45 to-transparent">
      {ticks.map(({ deg, offset }) => {
        const l = label(deg);
        return (
          <div
            key={`${deg}_${offset}`}
            className="absolute top-0 flex flex-col items-center -translate-x-1/2"
            style={{ left: `${50 + (offset / span) * 50}%` }}
          >
            <span className={`${l && l.length === 1 ? 'text-[14px] font-extrabold text-white' : 'text-[10px] text-white/80'} leading-4`}>
              {l ?? deg}
            </span>
            <span className={`w-px ${l ? 'h-2.5 bg-white' : 'h-1.5 bg-white/60'}`} />
          </div>
        );
      })}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-b-[7px] border-l-transparent border-r-transparent border-b-amber-400" />
    </div>
  );
}

export function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-10 h-10 rounded-xl flex items-center justify-center text-[18px] cursor-pointer active:scale-95 transition-transform ${glass}`}
    >
      {children}
    </button>
  );
}

/** Speed (and altitude when airborne-capable) next to the left thumb. */
export function SpeedPanel({ vehicle, speedKmh, altitudeM }: { vehicle: VehicleType; speedKmh: number; altitudeM: number }) {
  const icon = vehicle === 'ebike' ? '🛵' : vehicle === 'skyev' ? '🚗' : vehicle === 'riverboat' ? '🛶' : vehicle === 'tuktuk' ? '🛺' : '🚙';
  const flyer = vehicle === 'ebike' || vehicle === 'skyev';
  return (
    <div className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 ${glass}`}>
      <span className="text-lg">{icon}</span>
      <span className="text-[26px] font-extrabold font-mono-tabular text-amber-300 leading-none">{speedKmh}</span>
      <span className="text-[11px] text-white/80">km/h</span>
      {flyer && <span className="text-[13px] font-bold text-sky-200">▲ {altitudeM} m</span>}
    </div>
  );
}

interface DriveCtl {
  setVirtualThrottle: (t: number) => void;
  setVirtualStick: (x: number, y: number, sprint: boolean) => void;
  setVirtualJumpBrake: (held: boolean) => void;
  setVirtualDescend: (held: boolean) => void;
  toggleEnterExitVehicle: () => void;
  cycleMusicTrack: () => void;
  horn: () => void;
  cycleCamera: () => void;
}

/** Round translucent touch button that reports press / release. */
function HoldButton({
  onDown,
  onUp,
  label,
  sub,
  size = 'lg',
  tint,
}: {
  onDown: () => void;
  onUp?: () => void;
  label: React.ReactNode;
  sub?: string;
  size?: 'lg' | 'md' | 'sm';
  tint?: string;
}) {
  const dim = size === 'lg' ? 'w-[78px] h-[78px] text-[30px]' : size === 'md' ? 'w-16 h-16 text-[24px]' : 'w-12 h-12 text-[18px]';
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        onUp?.();
      }}
      onPointerCancel={() => onUp?.()}
      className={`${dim} rounded-full flex flex-col items-center justify-center select-none touch-none cursor-pointer active:scale-95 transition-transform border-2 border-white/45 backdrop-blur-md shadow-xl ${
        tint ?? 'bg-white/20'
      } text-white`}
    >
      <span className="leading-none">{label}</span>
      {sub && <span className="text-[10px] font-bold mt-0.5 leading-none">{sub}</span>}
    </button>
  );
}

/**
 * Driving / flying controls, laid out like the reference: throttle ▲▼ on the left with radio
 * and camera, steering ◀▶ on the right with climb / descend, get off and horn.
 */
export function DriveControls({ ctl, vehicle }: { ctl: DriveCtl | null; vehicle: VehicleType }) {
  const flyer = vehicle === 'ebike' || vehicle === 'skyev';
  return (
    <>
      <div className="fixed left-4 bottom-4 z-20 flex items-end gap-2 pointer-events-auto">
        <div className="flex flex-col gap-3">
          <HoldButton label="▲" onDown={() => ctl?.setVirtualThrottle(1)} onUp={() => ctl?.setVirtualThrottle(0)} />
          <HoldButton label="▼" onDown={() => ctl?.setVirtualThrottle(-1)} onUp={() => ctl?.setVirtualThrottle(0)} />
        </div>
        <div className="flex flex-col gap-3 mb-1">
          <HoldButton size="sm" label="📻" sub="ရေဒီယို" onDown={() => ctl?.cycleMusicTrack()} />
          <HoldButton size="sm" label="👁" onDown={() => ctl?.cycleCamera()} />
        </div>
      </div>
      <div className="fixed right-4 bottom-4 z-20 flex items-end gap-2.5 pointer-events-auto">
        <div className="flex flex-col items-center gap-2.5">
          {flyer && (
            <>
              <HoldButton size="md" label="⌃" sub="မြင့်" onDown={() => ctl?.setVirtualJumpBrake(true)} onUp={() => ctl?.setVirtualJumpBrake(false)} />
              <HoldButton size="md" label="⌄" sub="နိမ့်" onDown={() => ctl?.setVirtualDescend(true)} onUp={() => ctl?.setVirtualDescend(false)} />
            </>
          )}
          {!flyer && (
            <HoldButton size="md" label="■" sub="ဘရိတ်" onDown={() => ctl?.setVirtualJumpBrake(true)} onUp={() => ctl?.setVirtualJumpBrake(false)} />
          )}
          <HoldButton label="◀" onDown={() => ctl?.setVirtualStick(-1, 0, false)} onUp={() => ctl?.setVirtualStick(0, 0, false)} />
        </div>
        <div className="flex flex-col items-center gap-2.5">
          <HoldButton size="md" tint="bg-amber-300/40" label="✈" sub="ဆင်း/သက်" onDown={() => ctl?.toggleEnterExitVehicle()} />
          <HoldButton size="sm" label="📢" sub="ဟွန်း" onDown={() => ctl?.horn()} />
          <HoldButton label="▶" onDown={() => ctl?.setVirtualStick(1, 0, false)} onUp={() => ctl?.setVirtualStick(0, 0, false)} />
        </div>
      </div>
    </>
  );
}
