import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import {
  CameraMode,
  FamousBuildingInfo,
  HUDState,
  ManauBeatKey,
  MYITKYINA_FAMOUS_BUILDINGS,
  MYITKYINA_INTERACTIVE_NPCS,
  MYITKYINA_LANDMARKS,
  MYITKYINA_ROAD_SEGMENTS,
  MYITKYINA_TRAFFIC_LIGHTS,
  RoadSurfaceType,
  TimeOfDay,
  WeatherMode,
  worldToLatLng,
} from '../types/game';
import { GoogleSatelliteMap } from './GoogleSatelliteMap';
import { WORLD_BOUNDS } from '../world/mapData.generated';
import { riverCenterX, riverHalfWidth } from '../world/terrain';
import { GameControllerActions } from './MyitkyinaCanvas';
import { SaveSummary, formatSavedAgoMm, getSaveSummary } from '../save/saveSystem';
import { getSettings, updateSettings } from '../settings/gameSettings';
import { ControlsTutorial } from './ControlsTutorial';
import { SettingsPanel } from './SettingsPanel';

interface Props {
  hud: HUDState;
  controllerRef: React.MutableRefObject<GameControllerActions | null>;
}

// Ayeyarwady drawn as a filled band from the same river model the 3D terrain uses
const RIVER_POLYGON_PATH = (() => {
  const west: string[] = [];
  const east: string[] = [];
  for (let z = WORLD_BOUNDS.minZ - 400; z <= WORLD_BOUNDS.maxZ + 400; z += 40) {
    const cx = riverCenterX(z);
    const hw = riverHalfWidth(z);
    west.push(`${Math.round(cx - hw)},${z}`);
    east.push(`${Math.round(cx + hw)},${z}`);
  }
  return `M ${west.join(' L ')} L ${east.reverse().join(' L ')} Z`;
})();
const FULL_MAP_VIEWBOX = `${WORLD_BOUNDS.minX - 60} ${WORLD_BOUNDS.minZ - 60} ${
  WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX + 120
} ${WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ + 120}`;

function roadStrokeColor(surface: RoadSurfaceType): string {
  switch (surface) {
    case 'asphalt':
      return '#475569';
    case 'concrete':
      return '#94a3b8';
    case 'laterite_dirt':
      return '#b45309';
    case 'riverside_sand':
      return '#d97706';
  }
}

export const GameHUD: React.FC<Props> = ({ hud, controllerRef }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDockTab, setActiveDockTab] = useState<
    'minigames' | 'osm3d' | 'shops' | 'landmarks' | 'vehicles' | 'world'
  >('minigames');
  const [showMinimap, setShowMinimap] = useState(true);
  const [minimapMode, setMinimapMode] = useState<'radar3d' | 'satellite'>('radar3d');
  const [fullMapMode, setFullMapMode] = useState<'satellite' | 'vector'>('vector');
  const [fullMapOpen, setFullMapOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<FamousBuildingInfo | null>(
    MYITKYINA_FAMOUS_BUILDINGS[0],
  );
  const [touchPadEnabled] = useState(true);
  // 💾 Save summary (title / pause / gameover screens)
  const [saveSummary, setSaveSummary] = useState<SaveSummary | null>(() => getSaveSummary());
  const [confirmRestart, setConfirmRestart] = useState(false);
  useEffect(() => {
    if (hud.phase !== 'playing') setSaveSummary(getSaveSummary());
    setConfirmRestart(false);
  }, [hud.phase]);
  const [sprintLocked, setSprintLocked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- Map layers -------------------------------------------------------------
  // The 1:1 map has ~10k buildings. Re-rendering them on every HUD update (~11×/s)
  // tanked the frame rate, so the layers are memoized: the full map builds once,
  // the minimap rebuilds only when the player crosses a 50 m cell and only draws
  // what is within ~450 m.
  const osmRoads = hud.osm3d.roadPolylines;
  const osmFootprints = hud.osm3d.buildingFootprints;
  const osmLayerVisible = hud.osm3d.visible && osmRoads.length > 0;
  const radarCellX = Math.round(hud.playerX / 50);
  const radarCellZ = Math.round(hud.playerZ / 50);

  const fullMapLayers = useMemo(
    () => (
      <>
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          {osmLayerVisible
            ? osmRoads.map((rd, i) => (
                <polyline
                  key={`${rd.id}_${i}`}
                  points={rd.points.map((p) => `${p.x},${p.z}`).join(' ')}
                  stroke={
                    rd.highway === 'trunk' || rd.highway === 'primary'
                      ? '#f59e0b'
                      : rd.highway === 'tertiary' || rd.highway === 'secondary'
                        ? '#cbd5e1'
                        : '#64748b'
                  }
                  strokeWidth={
                    rd.highway === 'trunk' || rd.highway === 'primary' ? 12 : rd.highway === 'tertiary' ? 9 : 5
                  }
                  strokeOpacity="0.9"
                />
              ))
            : MYITKYINA_ROAD_SEGMENTS.map((seg) => (
                <line
                  key={seg.id}
                  x1={seg.x1}
                  y1={seg.z1}
                  x2={seg.x2}
                  y2={seg.z2}
                  stroke={roadStrokeColor(seg.surface)}
                  strokeWidth={seg.width}
                />
              ))}
        </g>
        {hud.osm3d.visible &&
          osmFootprints.map((bf, idx) => (
            <rect
              key={idx}
              x={bf.x - bf.w * 0.5}
              y={bf.z - bf.d * 0.5}
              width={bf.w}
              height={bf.d}
              fill={bf.color}
              opacity="0.88"
            />
          ))}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [osmRoads, osmFootprints, osmLayerVisible, hud.osm3d.visible],
  );

  const radarLayers = useMemo(() => {
    const cx = radarCellX * 50;
    const cz = radarCellZ * 50;
    const R = 450;
    const near = (x: number, z: number) => Math.abs(x - cx) < R && Math.abs(z - cz) < R;
    return (
      <>
        <g strokeLinecap="round" strokeLinejoin="round" fill="none">
          {osmLayerVisible
            ? osmRoads
                .filter((rd) => rd.points.some((p) => near(p.x, p.z)))
                .map((rd, i) => (
                  <polyline
                    key={`${rd.id}_${i}`}
                    points={rd.points.map((p) => `${p.x},${p.z}`).join(' ')}
                    stroke={
                      rd.highway === 'trunk' || rd.highway === 'primary' || rd.highway === 'trunk_link'
                        ? '#f59e0b'
                        : rd.highway === 'secondary' || rd.highway === 'tertiary'
                          ? '#cbd5e1'
                          : rd.highway === 'residential' || rd.highway === 'unclassified'
                            ? '#94a3b8'
                            : '#9a5229'
                    }
                    strokeWidth={
                      rd.highway === 'trunk' || rd.highway === 'primary'
                        ? 12
                        : rd.highway === 'secondary' || rd.highway === 'tertiary'
                          ? 9
                          : 6
                    }
                    strokeOpacity="0.92"
                  />
                ))
            : MYITKYINA_ROAD_SEGMENTS.filter((seg) => near(seg.x1, seg.z1) || near(seg.x2, seg.z2)).map(
                (seg) => (
                  <line
                    key={seg.id}
                    x1={seg.x1}
                    y1={seg.z1}
                    x2={seg.x2}
                    y2={seg.z2}
                    stroke={roadStrokeColor(seg.surface)}
                    strokeWidth={seg.width}
                  />
                ),
              )}
        </g>
        {hud.osm3d.visible &&
          osmFootprints
            .filter((bf) => near(bf.x, bf.z))
            .map((bf, idx) => (
              <rect
                key={idx}
                x={bf.x - bf.w * 0.5}
                y={bf.z - bf.d * 0.5}
                width={bf.w}
                height={bf.d}
                fill={bf.color}
                opacity="0.92"
              />
            ))}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osmRoads, osmFootprints, osmLayerVisible, hud.osm3d.visible, radarCellX, radarCellZ]);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // Resume play after a tutorial that auto-paused the game
  const tutorialPausedRef = useRef(false);

  // First time the player enters the world, show the controls guide
  useEffect(() => {
    if (hud.phase === 'playing' && !getSettings().tutorialSeen) {
      updateSettings({ tutorialSeen: true });
      tutorialPausedRef.current = true;
      controllerRef.current?.pauseGame();
      setTutorialOpen(true);
    }
  }, [hud.phase, controllerRef]);

  const closeTutorial = () => {
    setTutorialOpen(false);
    if (tutorialPausedRef.current) {
      tutorialPausedRef.current = false;
      controllerRef.current?.resumeGame();
    }
  };

  const overlayModals = (
    <>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {tutorialOpen && <ControlsTutorial onClose={closeTutorial} />}
    </>
  );
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickKnobRef = useRef<HTMLDivElement | null>(null);
  const stickPointerIdRef = useRef<number | null>(null);
  const stickTouchIdRef = useRef<number | null>(null);
  const stickOriginRef = useRef<{ x: number; y: number } | null>(null);
  const customSongInputRef = useRef<HTMLInputElement | null>(null);
  const customOsmInputRef = useRef<HTMLInputElement | null>(null);

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 600,
  }));

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const updateSize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', updateSize);
    window.addEventListener('orientationchange', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && hud.phase === 'playing') {
        setDrawerOpen((prev) => !prev);
      } else if (e.code === 'KeyN' && hud.phase === 'playing') {
        setFullMapOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase]);

  const requestLandscapeFullscreen = async () => {
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      }
      const scr = window.screen as Screen & {
        orientation?: { lock?: (mode: string) => Promise<void> };
      };
      if (scr.orientation && scr.orientation.lock) {
        await scr.orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Ignore if iframe restricts fullscreen
    }
  };

  const isPortraitBlocked = viewport.h > viewport.w && viewport.w < 920;
  const isCompactLandscape = viewport.h < 440;

  // Zero-React-Re-Render Direct DOM Virtual Analog Thumbstick (120fps Smooth Forward/Backward Control)
  const setKnobTransform = (dx: number, dy: number, active: boolean) => {
    const knob = stickKnobRef.current;
    if (!knob) return;
    knob.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${active ? 1.08 : 1})`;
  };

  const resetStick = () => {
    stickPointerIdRef.current = null;
    stickTouchIdRef.current = null;
    stickOriginRef.current = null;
    setKnobTransform(0, 0, false);
    controllerRef.current?.setVirtualStick(0, 0, sprintLocked);
  };

  const updateStickFromEvent = (clientX: number, clientY: number, isInitialDown = false) => {
    const el = stickBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;

    if (isInitialDown) {
      // Allow a slight floating origin near the center so thumb placement never jerks,
      // while tapping the outer half of the pad immediately moves in that direction.
      const initDx = clientX - centerX;
      const initDy = clientY - centerY;
      const initDist = Math.hypot(initDx, initDy);
      const maxOriginShift = rect.width * 0.12;
      if (initDist <= maxOriginShift) {
        stickOriginRef.current = { x: clientX, y: clientY };
      } else {
        stickOriginRef.current = {
          x: centerX + (initDx / initDist) * maxOriginShift,
          y: centerY + (initDy / initDist) * maxOriginShift,
        };
      }
    }

    const originX = stickOriginRef.current ? stickOriginRef.current.x : centerX;
    const originY = stickOriginRef.current ? stickOriginRef.current.y : centerY;

    let dx = clientX - originX;
    let dy = clientY - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setKnobTransform(dx, dy, true);

    const rawMag = Math.min(1, dist / maxR);
    if (rawMag < 0.04) {
      controllerRef.current?.setVirtualStick(0, 0, sprintLocked);
      return;
    }

    // Smooth, responsive analog curve (no sluggish deadzone)
    const curvedMag = ((rawMag - 0.04) / 0.96) ** 1.08;
    const dirX = dx / (dist || 1);
    const dirY = -dy / (dist || 1);

    const normX = dirX * curvedMag;
    const normY = dirY * curvedMag;
    const autoSprint = sprintLocked || rawMag > 0.78;
    controllerRef.current?.setVirtualStick(normX, normY, autoSprint);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return; // Handled directly by native touch events for zero mobile latency
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    stickPointerIdRef.current = e.pointerId;
    updateStickFromEvent(e.clientX, e.clientY, true);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromEvent(e.clientX, e.clientY, false);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch' || stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    resetStick();
  };

  const handleStickTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchIdRef.current !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    stickTouchIdRef.current = t.identifier;
    updateStickFromEvent(t.clientX, t.clientY, true);
  };

  const handleStickTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === stickTouchIdRef.current) {
        updateStickFromEvent(t.clientX, t.clientY, false);
        break;
      }
    }
  };

  const handleStickTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickTouchIdRef.current) {
        resetStick();
        break;
      }
    }
  };

  const activeQuest = hud.quests[hud.activeQuestIndex] || hud.quests[0];
  const completedQuestsCount = hud.quests.filter((q) => q.completed).length;
  const distToWaypoint = Math.round(
    Math.hypot(hud.waypointX - hud.playerX, hud.waypointZ - hud.playerZ),
  );
  const playerGeo = worldToLatLng(hud.playerX, hud.playerZ);

  // Convert cameraYaw into degrees so the GTA 3D Radar Minimap rotates smoothly with the camera view
  const radarRotationDeg = ((hud.cameraYaw - Math.PI) * 180) / Math.PI;
  const playerArrowDeg = ((hud.playerHeading - Math.PI) * 180) / Math.PI;

  // 0. MANDATORY HORIZONTAL (LANDSCAPE) BLOCKER OVERLAY WHEN PHONE IS HELD VERTICALLY
  if (isPortraitBlocked) {
    return (
      <div className="fixed inset-0 z-50 bg-[#060c0a] flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
        <div className="w-20 h-20 mb-5 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="2" y="6" width="20" height="12" rx="2.5" />
            <line x1="19" y1="10" x2="19" y2="14" />
            <path d="M8 2L11 5L8 8" />
          </svg>
        </div>

        <h2 className="text-xl font-bold font-display text-white mb-2">
          ဖုန်းကို အလျားလိုက် (Horizontal) လှည့်ပေးပါ
        </h2>
        <p className="text-xs text-slate-300 max-w-xs leading-relaxed mb-6">
          မြစ်ကြီးနား 3D Open World ဂိမ်းကို ကစားရန် ဖုန်း၏ Auto-Rotate ကိုဖွင့်ပြီး ဖုန်းကို{' '}
          <strong className="text-emerald-400">အလျားလိုက် (Landscape)</strong> ထားမှသာ
          ဆော့ကစားနိုင်ပါမည်။
        </p>

        <button
          onClick={requestLandscapeFullscreen}
          className="min-h-[44px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg cursor-pointer"
        >
          မျက်နှာပြင်အပြည့် အလျားလိုက်ပြောင်းရန် · Lock Landscape
        </button>
      </div>
    );
  }

  // 1. TITLE SCREEN SHELL
  if (hud.phase === 'title') {
    return (
      <div className="fixed inset-0 z-20 flex flex-col justify-between px-4 py-2.5 md:p-10 pointer-events-none select-none bg-gradient-to-t from-[#060b09]/92 via-[#060b09]/30 to-[#060b09]/75 overflow-hidden">
        <div className="flex items-center justify-between gap-2 text-[10px] md:text-xs tracking-wider text-emerald-300/90 shrink-0">
          <span className="truncate">
            ကချင်ပြည်နယ် · MYITKYINA GOOGLE SATELLITE & 3D OPEN WORLD
          </span>
          <div className="flex items-center gap-2 pointer-events-auto shrink-0">
            {!isOnline && <span className="text-amber-300 font-semibold">Offline</span>}
            <button
              onClick={requestLandscapeFullscreen}
              className="px-2 py-0.5 bg-slate-900/90 border border-white/15 rounded text-[10px] text-slate-200 cursor-pointer"
            >
              ⛶ Fullscreen
            </button>
          </div>
        </div>

        <div className="my-auto max-w-xl pointer-events-auto">
          <svg
            viewBox="0 0 540 105"
            className={`${isCompactLandscape ? 'w-64 mb-1' : 'w-full max-w-[440px] mb-3'} h-auto`}
            role="img"
            aria-label="Myitkyina Emerald Confluence Title Emblem"
          >
            <g transform="translate(8, 10)">
              <polygon
                points="38,0 76,38 38,76 0,38"
                fill="#991b1b"
                stroke="#f59e0b"
                strokeWidth="3"
              />
              <polygon
                points="38,12 64,38 38,64 12,38"
                fill="#064e3b"
                stroke="#10b981"
                strokeWidth="2"
              />
              <path
                d="M20,42 Q38,20 56,42 Q48,28 38,22 Q28,28 20,42 Z"
                fill="#fbbf24"
              />
              <circle cx="38" cy="44" r="4.5" fill="#fef08a" />
            </g>

            <text
              x="100"
              y="42"
              fill="#f8fafc"
              fontFamily="Outfit, sans-serif"
              fontWeight="800"
              fontSize="34"
              letterSpacing="1.5"
            >
              MYITKYINA 3D
            </text>
            <text
              x="100"
              y="70"
              fill="#34d399"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="18"
            >
              Google Earth ဂြိုဟ်တုမြေပုံ · လမ်းမကြီးများနှင့် နာမည်ကြီးဆိုင်များ
            </text>
            <line
              x1="100"
              y1="82"
              x2="475"
              y2="82"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeOpacity="0.65"
            />
          </svg>

          {!isCompactLandscape && (
            <p className="text-xs md:text-sm text-slate-200 max-w-lg leading-relaxed mb-4">
              မြစ်ကြီးနား မြို့လယ် ၃ × ၃ ကီလိုမီတာ — အရွယ်အစားအမှန် (1:1) မြေပုံ။ OpenStreetMap မှ
              လမ်းများ၊ အဆောက်အအုံများ၊ မီးရထားဘူတာနှင့် ဧရာဝတီ ကမ်းနားကို တကယ့်နေရာအတိုင်း ပြန်ဆောက်ထားပါသည်။
            </p>
          )}

          {saveSummary && (
            <div className="mb-2.5 inline-flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 rounded-lg bg-slate-900/85 border border-emerald-500/30 text-[10px] md:text-xs text-slate-200">
              <span className="font-semibold text-emerald-300">💾 သိမ်းထားသောဂိမ်း</span>
              <span>💰 {saveSummary.moneyMmk.toLocaleString()} MMK</span>
              <span>
                ✅ မစ်ရှင် {saveSummary.questsCompleted}/{saveSummary.questsTotal}
              </span>
              <span className="text-slate-400">{formatSavedAgoMm(saveSummary.savedAt)}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {saveSummary && (
              <button
                onClick={() => {
                  requestLandscapeFullscreen();
                  controllerRef.current?.continueGame();
                }}
                className="min-h-[40px] px-5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs md:text-sm rounded-lg shadow-lg transition-transform duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0"
              >
                ▶ ဆက်ကစားမည် · Continue
              </button>
            )}
            <button
              onClick={() => {
                if (saveSummary && !confirmRestart) {
                  setConfirmRestart(true);
                  return;
                }
                requestLandscapeFullscreen();
                controllerRef.current?.startGame();
              }}
              className={`min-h-[40px] px-5 py-2 ${
                saveSummary
                  ? confirmRestart
                    ? 'bg-red-700 hover:bg-red-600 border border-red-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 border border-white/15'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
              } text-white font-semibold text-xs md:text-sm rounded-lg shadow-lg transition-transform duration-150 active:scale-95 cursor-pointer whitespace-nowrap shrink-0`}
            >
              {saveSummary
                ? confirmRestart
                  ? '⚠️ သိမ်းထားချက် ပျက်မည် — ထပ်နှိပ်ပါ'
                  : 'ဂိမ်းအသစ် · New Game'
                : 'ဂိမ်းစတင်ဆော့မည် · Start Game'}
            </button>

            {!isInstalled && isInstallable && (
              <button
                onClick={install}
                className="min-h-[40px] px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs rounded-lg shadow-md cursor-pointer whitespace-nowrap shrink-0"
              >
                ဖုန်းထဲသွင်းရန် · Install
              </button>
            )}

            {!isInstalled && !isInstallable && isIOS && (
              <button
                onClick={() => setShowIOSGuide(true)}
                className="min-h-[40px] px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/20 text-white font-semibold text-xs rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                iOS တွင်သွင်းရန်
              </button>
            )}

            <button
              onClick={() => setTutorialOpen(true)}
              className="min-h-[40px] px-3 py-2 bg-slate-800/90 hover:bg-slate-700 border border-white/15 text-white font-semibold text-xs rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              🎮 ကစားနည်း
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="min-h-[40px] px-3 py-2 bg-slate-800/90 hover:bg-slate-700 border border-white/15 text-white font-semibold text-xs rounded-lg cursor-pointer whitespace-nowrap shrink-0"
              aria-label="Settings"
            >
              ⚙
            </button>
          </div>
        </div>

        <div className="text-[10px] md:text-xs text-slate-300 truncate shrink-0">
          Map © OpenStreetMap contributors (ODbL) · Buildings: Microsoft Building Footprints (ODbL) · 1:1 scale, 3 km × 3 km downtown Myitkyina · Google Satellite နှင့် 3D Radar Map ပြောင်းကြည့်နိုင်သည်
        </div>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
            <div className="w-full max-w-sm rounded-xl bg-[#0d171c] border border-white/15 p-4 shadow-2xl">
              <h3 className="text-sm font-bold text-white">
                iPhone / iPad Home Screen သို့ ထည့်သွင်းနည်း
              </h3>
              <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                ၁။ Safari ရှိ <strong>Share</strong> ခလုတ်ကို နှိပ်ပါ။ ၂။{' '}
                <strong>Add to Home Screen</strong> ကို ရွေးပါ။
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-3 w-full min-h-[38px] rounded-lg bg-emerald-600 text-xs font-semibold text-white cursor-pointer"
              >
                ပိတ်မည် · Close
              </button>
            </div>
          </div>
        )}
        {overlayModals}
      </div>
    );
  }

  // 2. PLAYING HUD — GTA-Style Adaptive Controls + Satellite / 3D Radar Minimap + Full Google Satellite Map
  const isDriving = hud.activeVehicle !== 'none';
  const stickSizeClass = isCompactLandscape ? 'w-[96px] h-[96px]' : 'w-32 h-32 md:w-36 md:h-36';
  const knobSizeClass = isCompactLandscape ? 'w-10 h-10' : 'w-12 h-12';
  const actionBtnClass = isCompactLandscape
    ? 'min-w-[56px] min-h-[36px] px-2 py-1 text-[11px]'
    : 'min-w-[72px] min-h-[50px] px-3 py-2 text-xs';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* SINGLE-ROW ULTRA-SLIM TOP BAR */}
      <div className="fixed top-1.5 left-2 right-2 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
        {/* Left Status Bar */}
        <div className="pointer-events-auto flex items-center gap-2 bg-[#0b1318]/92 border border-white/15 rounded-md px-2.5 py-1 shadow-md shrink-0">
          <div className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5 text-rose-500 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span className="text-[11px] font-bold font-mono-tabular text-white">
              {hud.health}
            </span>
          </div>

          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>

          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-400/50"
            title="လက်ရှိ မြန်မာကျပ်ငွေ လက်ကျန် (Myanmar Kyat Balance)"
          >
            <span className="text-[11px]">💵</span>
            <span className="text-[11px] font-extrabold font-mono-tabular text-emerald-300 whitespace-nowrap">
              {hud.jadeCount.toLocaleString()} MMK
            </span>
          </div>

          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>

          <button
            onClick={() => controllerRef.current?.upgradeHeroLevel()}
            className="px-1.5 py-0.5 rounded bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-300/60 text-[10px] font-bold text-white cursor-pointer whitespace-nowrap"
            title="40,000 MMK သုံး၍ စွမ်းရည်နှင့် ဆိုင်ကယ်အမြန်နှုန်း အဆင့်မြှင့်ရန်"
          >
            ⚡ Lv.{hud.meritLevel} (40k MMK)
          </button>

          <span className="text-slate-600 hidden md:inline" aria-hidden="true">
            ·
          </span>

          <span className="text-[11px] font-semibold text-amber-300 truncate max-w-[110px] sm:max-w-[150px] hidden md:inline">
            {hud.currentRegion.nameMm}
          </span>

          {isDriving && (
            <>
              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-[11px] font-bold font-mono-tabular text-sky-300">
                {hud.speedKmh} km/h
              </span>
            </>
          )}
        </div>

        {/* Right Compact Action Strip — scrolls sideways on narrow screens; ⛶ ⚙ ⏸ always stay visible */}
        <div className="flex items-center gap-1 min-w-0">
        <div className="pointer-events-auto flex items-center gap-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
          <input
            ref={customSongInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await controllerRef.current?.uploadCustomSong(file);
              }
              e.target.value = '';
            }}
          />
          <input
            ref={customOsmInputRef}
            type="file"
            accept=".geojson,.json,.osm,.xml"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await controllerRef.current?.uploadCustomOsmFile(file);
              }
              e.target.value = '';
            }}
          />

          <button
            onClick={() => controllerRef.current?.teleportToOsmCity()}
            className="px-2 py-1 rounded text-[11px] font-extrabold bg-emerald-500 hover:bg-emerald-400 border-2 border-white text-slate-950 cursor-pointer whitespace-nowrap shadow-md"
            title="Teleport to City — Spawns player on a collision-safe drivable OSM road inside dense Myitkyina 3D building clusters"
          >
            🏙️ မြို့လယ်သို့သွားမည်
          </button>

          <button
            onClick={() => controllerRef.current?.toggleOverheadCamera()}
            className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer whitespace-nowrap shadow ${
              hud.cameraMode === 'overhead'
                ? 'bg-amber-400 border-white text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 border-amber-400/60 text-amber-300'
            }`}
            title="Toggle Temporary Overhead Camera to inspect the imported Myitkyina OSM road & building network"
          >
            {hud.cameraMode === 'overhead' ? '🛰️ အပေါ်စီး ON' : '🛰️ အပေါ်စီးကင်မရာ'}
          </button>

          <button
            onClick={() => controllerRef.current?.toggleOsmDebugMode()}
            className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer whitespace-nowrap shadow ${
              hud.osm3d.debugMode
                ? 'bg-cyan-400 border-white text-slate-950'
                : 'bg-slate-900/95 hover:bg-slate-800 border-cyan-400/60 text-cyan-300'
            }`}
            title="Toggle Temporary OSM Debug Mode (Shows OSM Bounding Box, Player Pos, Nearest Road & Building Count)"
          >
            🔍 OSM Debug
          </button>

          <button
            onClick={() => {
              setActiveDockTab('osm3d');
              setDrawerOpen(true);
            }}
            className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer whitespace-nowrap shadow hidden xl:inline-block ${
              hud.osm3d.visible
                ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-300 text-white'
                : 'bg-slate-800 border-slate-500 text-slate-300'
            }`}
            title="Myitkyina OpenStreetMap 3D City Layer (1,123 Buildings + 2,821 Roads)"
          >
            🗺️ OSM ({hud.osm3d.buildingsCount + hud.osm3d.roadsCount})
          </button>

          <button
            onClick={() => {
              if (hud.fishing.active) {
                controllerRef.current?.stopFishing();
              } else {
                controllerRef.current?.startFishingAtSpot('spot_balaminhtin');
              }
            }}
            className={`px-2 py-1 rounded text-[11px] font-bold border cursor-pointer whitespace-nowrap shadow ${
              hud.fishing.active
                ? 'bg-sky-400 border-white text-slate-950 animate-pulse'
                : 'bg-sky-600 hover:bg-sky-500 border-sky-300 text-white'
            }`}
            title="ဗလမင်းထင်တံတားအောက် & ဧရာဝတီမြစ်ဘေး ငါးမျှားဂိမ်းနှင့် ငါးအဝယ်ဒိုင်"
          >
            {hud.fishing.active
              ? '🎣 ငါးမျှားရပ်မည်'
              : hud.fishing.fishBasket.length > 0
                ? `🎣 ငါးမျှား/ရောင်း (${hud.fishing.fishBasket.length})`
                : '🎣 ငါးမျှား/ငါးဆိုင်'}
          </button>

          <button
            onClick={() => controllerRef.current?.summonVehicle('ebike')}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-amber-500/95 hover:bg-amber-400 border border-yellow-300 text-slate-950 cursor-pointer whitespace-nowrap shadow"
            title="Summon AIMA Electric Scooter (ဘက်ထရီဆိုင်ကယ် ခေါ်ယူရန်)"
          >
            🛵 ဘက်ထရီဆိုင်ကယ်
          </button>

          <button
            onClick={() => controllerRef.current?.toggleManauDance()}
            className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer whitespace-nowrap shadow hidden sm:inline-block ${
              hud.isManauDancing
                ? 'bg-amber-400 border-white text-slate-950 animate-pulse'
                : 'bg-rose-700/95 hover:bg-rose-600 border-amber-300/80 text-amber-200'
            }`}
            title="ကချင်ရိုးရာ မနောအက ကရန် (Manau Festival Dance)"
          >
            {hud.isManauDancing ? '💃 ကနေသည်' : '💃 မနောအက'}
          </button>

          <button
            onClick={() => controllerRef.current?.startFoodDelivery()}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 border border-rose-300 text-white cursor-pointer whitespace-nowrap shadow"
            title="Start Kachin Food Delivery Job (+35,000 MMK)"
          >
            📦 မုန့်ပို့ (+35k)
          </button>

          <button
            onClick={() => controllerRef.current?.startStreetTimeTrial()}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 border border-indigo-300 text-white cursor-pointer whitespace-nowrap shadow hidden lg:inline-block"
            title="Start Sitapu Street Time Trial Race (+45,000 MMK)"
          >
            🏁 ပြိုင်ပွဲ (+45k)
          </button>

          <button
            onClick={() => {
              const nextWeather: WeatherMode =
                hud.weather === 'clear' ? 'mist' : hud.weather === 'mist' ? 'rain' : 'clear';
              controllerRef.current?.setWeather(nextWeather);
            }}
            className="px-2 py-1 rounded text-[11px] font-medium bg-[#0b1318]/92 border border-sky-400/50 text-sky-300 cursor-pointer whitespace-nowrap"
            title="Toggle Myitkyina Weather (နေသာ / မြူနှင်း / မိုးရွာ)"
          >
            {hud.weather === 'clear' ? '☀ နေသာ' : hud.weather === 'mist' ? '🌫 မြူနှင်း' : '🌧 မိုးရွာ'}
          </button>

          <button
            onClick={() => controllerRef.current?.resetCameraBehindPlayer()}
            className="px-2 py-1 rounded text-[11px] font-medium bg-[#0b1318]/92 border border-white/15 text-sky-300 cursor-pointer whitespace-nowrap hidden md:inline-block"
            title="Center Camera Behind Player (R)"
          >
            ကင်မရာတည့်
          </button>

          <button
            onClick={() => setFullMapOpen(true)}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-white cursor-pointer whitespace-nowrap"
          >
            ဂြိုဟ်တုမြေပုံ
          </button>

          <button
            onClick={() => setShowMinimap((m) => !m)}
            className={`px-2 py-1 rounded text-[11px] font-medium border cursor-pointer whitespace-nowrap ${
              showMinimap
                ? 'bg-[#0b1318]/92 border-emerald-400/60 text-emerald-300'
                : 'bg-[#0b1318]/92 border-white/15 text-slate-400'
            }`}
          >
            Map
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1 shrink-0">
          <button
            onClick={requestLandscapeFullscreen}
            className="px-2 py-1 bg-[#0b1318]/92 border border-white/15 rounded text-[11px] text-slate-200 cursor-pointer"
            title="Fullscreen"
          >
            ⛶
          </button>

          <button
            onClick={() => setSettingsOpen(true)}
            className="px-2 py-1 bg-[#0b1318]/92 border border-white/15 rounded text-[11px] text-slate-200 cursor-pointer"
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>

          <button
            onClick={() => controllerRef.current?.pauseGame()}
            className="px-2 py-1 bg-[#0b1318]/92 border border-white/15 rounded text-[11px] font-semibold text-slate-200 cursor-pointer"
          >
            ⏸
          </button>
        </div>
        </div>
      </div>

      {/* TOP-LEFT COMPACT ACTIVE MISSION TRACKER + E-BIKE & FESTIVAL MUSIC PLAYER */}
      <div className="fixed top-9 left-2 z-20 flex flex-col gap-1.5 pointer-events-auto max-w-[340px] sm:max-w-[420px]">
        <div className="flex items-center gap-1.5">
          <div className="bg-[#0b1318]/92 border border-emerald-500/45 rounded-md px-2.5 py-1 flex items-center gap-2 shadow-lg min-w-0">
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-emerald-300 truncate">
                မစ်ရှင် [{completedQuestsCount}/{hud.quests.length}]: {activeQuest.titleMm}
              </div>
              <div className="text-[9px] text-slate-300 truncate">
                ပြီးစီးမှု ({activeQuest.progress}/{activeQuest.goal}) · အကွာအဝေး{' '}
                <span className="font-mono-tabular text-amber-300 font-bold">{distToWaypoint}m</span>
              </div>
            </div>

            <button
              onClick={() => controllerRef.current?.warpToActiveQuest()}
              className="shrink-0 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 border border-emerald-300 text-[10px] font-bold text-white cursor-pointer shadow whitespace-nowrap"
              title="မစ်ရှင်နေရာသို့ ချက်ချင်းသွားရန်"
            >
              ⚡ တန်းသွားမည်
            </button>
          </div>

          {hud.comboCount > 1 && (
            <div className="px-2 py-1 rounded-md bg-amber-500/95 border border-yellow-200 text-slate-950 font-extrabold text-[11px] shadow-lg whitespace-nowrap">
              🔥 {hud.comboCount}x COMBO!
            </div>
          )}
        </div>

        {/* E-BIKE & MANAU MUSIC PLAYER BAR (Sample Song 1, Sample Song 2, Custom Song Slot, Off) */}
        <div
          className={`rounded-md px-2 py-1 flex flex-wrap items-center gap-1 shadow-lg border transition-colors ${
            hud.activeVehicle === 'ebike' || hud.isManauDancing
              ? 'bg-[#0b171e]/95 border-amber-400/80'
              : 'bg-[#0b1318]/90 border-white/15'
          }`}
        >
          <span className="text-[10px] font-bold text-amber-300 mr-0.5 whitespace-nowrap">
            {hud.activeVehicle === 'ebike' ? '🛵 သီချင်း:' : '🎵 သီချင်း:'}
          </span>

          <button
            onClick={() => controllerRef.current?.selectMusicTrack('sample1')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
              hud.musicTrack === 'sample1'
                ? 'bg-emerald-500 text-slate-950 border border-white'
                : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700 border border-white/10'
            }`}
            title="Sample Song 1: မြစ်ကြီးနား မနောမြေ (Manau Groove)"
          >
            🎵 သီချင်း ၁
          </button>

          <button
            onClick={() => controllerRef.current?.selectMusicTrack('sample2')}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
              hud.musicTrack === 'sample2'
                ? 'bg-amber-400 text-slate-950 border border-white'
                : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700 border border-white/10'
            }`}
            title="Sample Song 2: စီတာပူ လေပြည် (Sitapu E-Bike Pop)"
          >
            🎵 သီချင်း ၂
          </button>

          {hud.hasCustomSong && (
            <button
              onClick={() => controllerRef.current?.selectMusicTrack('custom')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                hud.musicTrack === 'custom'
                  ? 'bg-sky-400 text-slate-950 border border-white'
                  : 'bg-slate-800/90 text-sky-300 hover:bg-slate-700 border border-sky-400/30'
              }`}
              title={hud.musicTrackLabel}
            >
              🎶 ကိုယ်ပိုင်
            </button>
          )}

          <button
            onClick={() => customSongInputRef.current?.click()}
            className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-950/90 hover:bg-indigo-800 text-indigo-200 border border-indigo-400/40 cursor-pointer whitespace-nowrap"
            title="ဖုန်း/ကွန်ပျူတာထဲမှ ကိုယ်ပိုင် MP3 သီချင်း ထည့်သွင်းရန် (Custom Song)"
          >
            📂 +သီချင်း
          </button>

          {hud.musicTrack !== 'off' && (
            <button
              onClick={() => controllerRef.current?.selectMusicTrack('off')}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-900/80 hover:bg-rose-700 text-rose-200 border border-rose-400/40 cursor-pointer whitespace-nowrap"
              title="သီချင်းပိတ်ရန်"
            >
              🔇 ပိတ်
            </button>
          )}
        </div>

        {/* =========================================================================
            TEMPORARY OSM 3D DEBUG TELEMETRY PANEL (BOUNDING BOX, PLAYER, NEAREST ROAD & BUILDING COUNT)
           ========================================================================= */}
        {hud.osm3d.debugMode && (
          <div className="bg-[#041218]/95 border-2 border-cyan-400 rounded-lg p-2 text-[10px] text-slate-100 shadow-2xl space-y-1">
            <div className="flex items-center justify-between gap-2 border-b border-cyan-500/30 pb-1">
              <span className="font-extrabold text-cyan-300">
                🔍 OSM 3D DEBUG INSPECTOR ({hud.osm3d.buildingsCount.toLocaleString()} Bldgs +{' '}
                {hud.osm3d.roadsCount.toLocaleString()} Roads)
              </span>
              <button
                onClick={() => controllerRef.current?.toggleOsmDebugMode()}
                className="px-1.5 py-0.5 rounded bg-rose-700 text-white font-bold text-[9px] cursor-pointer"
              >
                ✕ ပိတ်
              </button>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono-tabular text-[9px]">
              <div className="text-emerald-300">
                📍 Player World: X={hud.playerX}m, Z={hud.playerZ}m
              </div>
              <div className="text-amber-300">
                🌐 Player Geo: {playerGeo.lat.toFixed(4)}°N, {playerGeo.lng.toFixed(4)}°E
              </div>
              <div className="text-cyan-200 col-span-2">
                📦 OSM Bldgs BBox: [{hud.osm3d.bbox.minX}..{hud.osm3d.bbox.maxX}, Z:{' '}
                {hud.osm3d.bbox.minZ}..{hud.osm3d.bbox.maxZ}] ({hud.osm3d.bbox.minLat}°N–
                {hud.osm3d.bbox.maxLat}°N, {hud.osm3d.bbox.minLng}°E–{hud.osm3d.bbox.maxLng}°E)
              </div>
              <div className="text-slate-300 col-span-2">
                🛣️ Nearest OSM Road:{' '}
                <strong className="text-white">{hud.osm3d.nearestRoadName}</strong> (
                <span className="text-amber-300">{hud.osm3d.nearestRoadDistM}m</span>)
              </div>
              <div className="col-span-2">
                🏢 OSM Buildings within 150m:{' '}
                <strong
                  className={
                    hud.osm3d.nearbyBuildings150m > 10 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {hud.osm3d.nearbyBuildings150m} buildings
                </strong>{' '}
                {hud.osm3d.nearbyBuildings150m < 5 &&
                  '(⚠ Spawn is in Sitapu Park; click Teleport to City below!)'}
              </div>
            </div>

            <div className="pt-1 border-t border-cyan-500/30 flex flex-wrap items-center gap-1">
              {hud.osm3d.citySpawnPoints.map((sp, idx) => (
                <button
                  key={sp.id}
                  onClick={() => controllerRef.current?.teleportToOsmCity(idx)}
                  className="px-1.5 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[9px] cursor-pointer"
                >
                  🏙️ {sp.nameEn.split(' ')[0]} ({sp.buildingsNearby} Bldgs)
                </button>
              ))}
              <button
                onClick={() => controllerRef.current?.toggleOverheadCamera()}
                className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[9px] cursor-pointer"
              >
                🛰️ {hud.cameraMode === 'overhead' ? 'Chase Cam' : 'Overhead Cam'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TOAST NOTIFICATION, ACTIVE CHALLENGE TIMER, NPC DIALOGUE & CONTEXTUAL PROMPTS */}
      <div className="fixed top-9 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none w-full max-w-md px-2">
        {/* =========================================================================
            INTERACTIVE NPC DIALOGUE, QUEST GIVER & TRADING MODAL
           ========================================================================= */}
        {hud.activeNpcDialogue && (
          <div className="pointer-events-auto w-full max-w-md bg-[#08131a]/96 border-2 border-amber-400 rounded-xl p-3 shadow-2xl space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-white/15 pb-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-extrabold uppercase">
                    {hud.activeNpcDialogue.npc.role === 'shopkeeper'
                      ? '🛒 ဈေးဆိုင်ရှင် (Shopkeeper)'
                      : hud.activeNpcDialogue.npc.role === 'quest_giver'
                        ? '📜 မစ်ရှင်ပေးသူ (Quest Giver)'
                        : '💬 မြို့ခံပြည်သူ (Citizen)'}
                  </span>
                  <span className="text-xs font-extrabold text-white truncate">
                    {hud.activeNpcDialogue.npc.nameMm}
                  </span>
                </div>
                <div className="text-[10px] text-amber-300 truncate">
                  {hud.activeNpcDialogue.npc.roleLabelMm} · {hud.activeNpcDialogue.npc.locationMm}
                </div>
              </div>
              <button
                onClick={() => controllerRef.current?.closeNpcDialogue()}
                className="px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-600 text-[10px] font-bold text-white cursor-pointer shrink-0"
              >
                ✕ ပိတ်မည်
              </button>
            </div>

            {/* NPC Speech Bubble */}
            <div className="p-2 rounded-lg bg-slate-900/95 border border-emerald-500/40 text-[11px] text-slate-100 leading-relaxed">
              “{hud.activeNpcDialogue.currentReplyMm}”
            </div>

            {/* Shopkeeper Trading Items (Buy / Sell) */}
            {hud.activeNpcDialogue.npc.tradeItems &&
              hud.activeNpcDialogue.npc.tradeItems.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-amber-300">
                    🛒 အရောင်းအဝယ် ပစ္စည်းများ (Trading & Shop):
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {hud.activeNpcDialogue.npc.tradeItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-1.5 rounded bg-slate-900 border border-white/15 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-white truncate">
                            {item.nameMm}
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {item.descriptionMm}
                          </div>
                        </div>
                        <button
                          onClick={() => controllerRef.current?.buyOrSellNpcItem(item.id)}
                          className="shrink-0 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] cursor-pointer whitespace-nowrap"
                        >
                          {item.effectType === 'sell_all_fish'
                            ? `💰 ငါးရောင်းမည် (${hud.fishing.fishBasket.length})`
                            : `🛒 ${item.priceMmk.toLocaleString()} MMK`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Interactive Dialogue Options */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-emerald-300">
                💬 ဆွေးနွေးမေးမြန်းရန် ရွေးချယ်မှုများ (Dialogue Options):
              </div>
              <div className="grid grid-cols-1 gap-1">
                {hud.activeNpcDialogue.npc.dialogueOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => controllerRef.current?.selectNpcDialogueOption(opt.id)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/95 hover:bg-emerald-900/80 border border-emerald-400/40 text-left text-[10px] font-bold text-slate-100 cursor-pointer transition-colors"
                  >
                    ▸ {opt.labelMm}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {hud.activeChallenge && (
          <div className="w-full bg-[#0b1318]/95 border-2 border-amber-400 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2 shadow-xl">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-300 truncate">
                {hud.activeChallenge.titleMm}
              </div>
              <div className="text-[10px] text-emerald-300 truncate">
                ✦ {hud.activeChallenge.stepLabelMm}
              </div>
            </div>
            <div className="shrink-0 px-2 py-0.5 rounded bg-rose-600 text-white font-mono-tabular text-xs font-bold">
              {Math.ceil(hud.activeChallenge.timeRemainingSec)}s
            </div>
          </div>
        )}
        {hud.isManauDancing && (
          <div className="pointer-events-auto w-full max-w-md bg-[#0b1318]/96 border-2 border-amber-400 rounded-xl p-2.5 shadow-2xl">
            {/* Header: Title, Quest Progress & Stop Button */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-extrabold text-amber-300 truncate">
                  💃 မနောအက သံစဉ်ချက် မစ်ရှင် ({Math.min(hud.manauRhythm.hitsCompleted, hud.manauRhythm.hitsGoal)}/{hud.manauRhythm.hitsGoal})
                </span>
                {hud.manauRhythm.streak > 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-extrabold shrink-0">
                    🔥 {hud.manauRhythm.streak}x
                  </span>
                )}
              </div>
              <button
                onClick={() => controllerRef.current?.toggleManauDance()}
                className="px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-600 border border-rose-300 text-[10px] font-bold text-white cursor-pointer shrink-0"
              >
                ✕ အကရပ်မည်
              </button>
            </div>

            {/* Rhythm Beat Timing Bar + Sweet Spot Target Window */}
            <div className="relative h-5 w-full rounded-full bg-slate-900 border border-white/20 overflow-hidden mb-1.5">
              {/* Sweet Spot Hit Zone (55% to 96%) */}
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-500/35 via-amber-400/55 to-emerald-500/35 border-x-2 border-amber-300"
                style={{ left: '55%', width: '41%' }}
              />
              <div
                className="absolute top-0.5 bottom-0.5 flex items-center justify-center text-[9px] font-extrabold text-amber-200 pointer-events-none"
                style={{ left: '55%', width: '41%' }}
              >
                ★ နှိပ်ရန် စည်းချက်ဇုန် (HIT ZONE) ★
              </div>

              {/* Moving Musical Beat Pulse Marker */}
              <div
                className="absolute top-0.5 bottom-0.5 w-4 -ml-2 rounded-full bg-white border-2 border-amber-400 shadow-lg transition-all duration-75"
                style={{ left: `${Math.round(hud.manauRhythm.beatProgress * 100)}%` }}
              />
            </div>

            {/* Current Target Prompt & Upcoming Queue */}
            <div className="flex items-center justify-between gap-2 text-[10px] mb-2">
              <div
                className={`font-bold truncate ${
                  hud.manauRhythm.lastRating === 'PERFECT'
                    ? 'text-amber-300'
                    : hud.manauRhythm.lastRating === 'GOOD'
                      ? 'text-emerald-300'
                      : hud.manauRhythm.lastRating === 'MISS'
                        ? 'text-rose-400'
                        : 'text-slate-200'
                }`}
              >
                {hud.manauRhythm.lastRatingTextMm}
              </div>
              <div className="flex items-center gap-1 shrink-0 text-slate-400">
                <span>နောက်ချက်:</span>
                {hud.manauRhythm.upcomingQueue.map((k, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/15 text-[10px] font-bold text-amber-200"
                  >
                    {k === 'left' ? '◀' : k === 'up' ? '▲' : k === 'down' ? '▼' : '▶'}
                  </span>
                ))}
              </div>
            </div>

            {/* 4 Interactive Rhythm Dance Buttons (Touch + Mouse + Keyboard A/W/S/D or Arrows) */}
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { key: 'left' as ManauBeatKey, icon: '◀', label: 'ဘယ်ယပ်', kb: 'A / ←' },
                  { key: 'up' as ManauBeatKey, icon: '▲', label: 'မြှောက်', kb: 'W / ↑' },
                  { key: 'down' as ManauBeatKey, icon: '▼', label: 'စည်ချက်', kb: 'S / ↓' },
                  { key: 'right' as ManauBeatKey, icon: '▶', label: 'ညာယပ်', kb: 'D / →' },
                ]
              ).map((btn) => {
                const isTarget = hud.manauRhythm.currentBeatKey === btn.key;
                const inHitWindow =
                  isTarget &&
                  hud.manauRhythm.beatProgress >= 0.48 &&
                  hud.manauRhythm.beatProgress <= 0.98;
                return (
                  <button
                    key={btn.key}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      controllerRef.current?.pressManauRhythmKey(btn.key);
                    }}
                    className={`py-1.5 px-1 rounded-lg border-2 flex flex-col items-center justify-center transition-transform active:scale-90 cursor-pointer touch-none ${
                      inHitWindow
                        ? 'bg-amber-400 border-white text-slate-950 shadow-lg scale-105'
                        : isTarget
                          ? 'bg-emerald-700/90 border-amber-300 text-white shadow'
                          : 'bg-slate-900/90 border-white/20 text-slate-200 hover:border-white/40'
                    }`}
                  >
                    <span className="text-sm font-extrabold leading-none">
                      {btn.icon} {btn.label}
                    </span>
                    <span
                      className={`text-[9px] font-mono-tabular mt-0.5 ${
                        inHitWindow ? 'text-slate-900 font-bold' : 'text-slate-400'
                      }`}
                    >
                      [{btn.kb}]
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            AYEYARWADY RIVERBANK & UNDER BALAMINHTIN BRIDGE FISHING + FISH SHOP HUD
           ========================================================================= */}
        {hud.fishing.active && (
          <div className="pointer-events-auto w-full max-w-md bg-[#08161d]/96 border-2 border-sky-400 rounded-xl p-2.5 shadow-2xl">
            {/* Header: Spot Name + Balance + Exit */}
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-sky-300 truncate">
                  🎣 {hud.fishing.spotNameMm}
                </div>
                <div className="text-[9px] text-slate-300 truncate">
                  ရောင်းပြီးငါး: <strong className="text-emerald-300">{hud.fishing.totalSoldCount}</strong> ကောင် · စုစုပေါင်းရငွေ:{' '}
                  <strong className="text-amber-300 font-mono-tabular">
                    {hud.fishing.totalEarnedMmk.toLocaleString()} MMK
                  </strong>
                </div>
              </div>

              <button
                onClick={() => controllerRef.current?.stopFishing()}
                className="px-2 py-0.5 rounded bg-rose-700 hover:bg-rose-600 border border-rose-300 text-[10px] font-bold text-white cursor-pointer shrink-0"
              >
                ✕ ထွက်မည်
              </button>
            </div>

            {/* Quick Spot Switcher (Under Balaminhtin Bridge / Sitapu Riverbank / Myitsone) */}
            <div className="grid grid-cols-3 gap-1 mb-1.5">
              {[
                { id: 'spot_balaminhtin', label: '🌊 ကမ်းနားလမ်း မြောက် (1.5x)' },
                { id: 'spot_sitapu_jetty', label: '🛕 စေတီ ကမ်းနား' },
                { id: 'spot_myitsone', label: '🌊 ကမ်းနားလမ်း တောင် (1.8x)' },
              ].map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => controllerRef.current?.startFishingAtSpot(sp.id)}
                  className={`px-1.5 py-1 rounded text-[9px] font-bold truncate border cursor-pointer ${
                    hud.fishing.spotNameMm.includes(
                      sp.id === 'spot_balaminhtin'
                        ? 'ကမ်းနားလမ်း မြောက်'
                        : sp.id === 'spot_sitapu_jetty'
                          ? 'ဆုတောင်းပြည့်စေတီ'
                          : 'ကမ်းနားလမ်း တောင်',
                    )
                      ? 'bg-sky-600 border-white text-white'
                      : 'bg-slate-900/90 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>

            {/* Fishing Gear Status & Upgrade Bar (Lv.0 -> Lv.1 Budget 30k -> Lv.2 75k -> Lv.3 160k) */}
            <div className="rounded-lg bg-slate-900/95 border border-amber-400/45 p-1.5 mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-amber-300 truncate">
                  🛠️ လက်ရှိကိရိယာ (Lv.{hud.fishing.rodLevel}): {hud.fishing.rodNameMm}
                </div>
                <div className="text-[9px] text-slate-300 truncate">
                  {hud.fishing.rodCapabilityMm}
                </div>
              </div>

              {hud.fishing.nextUpgradeCostMmk !== null && (
                <button
                  onClick={() => controllerRef.current?.buyOrUpgradeFishingGear()}
                  className={`shrink-0 px-2 py-1 rounded text-[10px] font-extrabold border cursor-pointer whitespace-nowrap shadow ${
                    hud.jadeCount >= hud.fishing.nextUpgradeCostMmk
                      ? 'bg-amber-400 hover:bg-amber-300 border-white text-slate-950 animate-pulse'
                      : 'bg-slate-800 border-white/20 text-slate-400'
                  }`}
                >
                  {hud.fishing.rodLevel === 0
                    ? `🛒 ဝါးငါးမျှားတံဝယ်မည် (${hud.fishing.nextUpgradeCostMmk.toLocaleString()} MMK)`
                    : `⬆️ Lv.${hud.fishing.rodLevel + 1} မြှင့်မည် (${hud.fishing.nextUpgradeCostMmk.toLocaleString()} MMK)`}
                </button>
              )}
            </div>

            {/* Caught Fish Basket & Fish Shop Selling Bar (ဧရာဝတီ ငါးအဝယ်ဒိုင်) */}
            <div className="rounded-lg bg-emerald-950/75 border border-emerald-400/50 p-1.5 mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-emerald-300 truncate">
                  🐟 ငါးပလိုင်း: {hud.fishing.fishBasket.length} ကောင် · တန်ဖိုး{' '}
                  <span className="text-amber-300 font-mono-tabular">
                    {hud.fishing.basketValueMmk.toLocaleString()} MMK
                  </span>
                </div>
                <div className="text-[9px] text-slate-300 truncate">
                  {hud.fishing.lastCatch
                    ? `နောက်ဆုံးဖမ်းမိ: ${hud.fishing.lastCatch.icon} ${hud.fishing.lastCatch.nameMm} (${hud.fishing.lastCatch.weightKg}kg · ${hud.fishing.lastCatch.priceMmk.toLocaleString()} MMK)`
                    : 'ဖမ်းမိသောငါးများကို ငါးအဝယ်ဒိုင်သို့ ရောင်းချမှ ကျပ်ငွေ (MMK) ရရှိပါမည်'}
                </div>
              </div>

              <button
                onClick={() => controllerRef.current?.sellCaughtFish()}
                disabled={hud.fishing.fishBasket.length === 0}
                className={`shrink-0 px-2.5 py-1 rounded text-[10px] font-extrabold border whitespace-nowrap shadow ${
                  hud.fishing.fishBasket.length > 0
                    ? 'bg-emerald-500 hover:bg-emerald-400 border-white text-slate-950 cursor-pointer animate-bounce'
                    : 'bg-slate-800/80 border-white/15 text-slate-500 cursor-not-allowed'
                }`}
              >
                💰 ငါးဆိုင်သို့ ရောင်းမည် (+{hud.fishing.basketValueMmk.toLocaleString()} MMK)
              </button>
            </div>

            {/* Interactive Tension Gauge & Reel Progress (Only shown when player owns gear!) */}
            {hud.fishing.rodLevel > 0 && (
              <>
                <div className="relative h-6 w-full rounded-full bg-slate-950 border border-sky-400/50 overflow-hidden mb-1">
                  {/* Player Green Catch Bar (Width scales with Rod Level: Lv.1=26%, Lv.2=42%, Lv.3=56%!) */}
                  <div
                    className="absolute top-0.5 bottom-0.5 rounded-full bg-emerald-500/45 border-2 border-emerald-300 transition-all duration-75"
                    style={{
                      left: `${Math.max(
                        0,
                        Math.min(
                          100 - hud.fishing.barHalfWidth * 2,
                          hud.fishing.barPosition - hud.fishing.barHalfWidth,
                        ),
                      )}%`,
                      width: `${hud.fishing.barHalfWidth * 2}%`,
                    }}
                  />

                  {/* Swimming Fish Icon */}
                  <div
                    className="absolute top-0 bottom-0 flex items-center justify-center text-sm transition-all duration-75 select-none pointer-events-none"
                    style={{ left: `calc(${hud.fishing.fishPosition}% - 10px)` }}
                  >
                    {hud.fishing.phase === 'bite' ? '⚡🐟' : '🐟'}
                  </div>
                </div>

                {/* Reel-in Progress Bar (0..100%) */}
                <div className="w-full h-2 rounded-full bg-slate-900 border border-white/15 overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-300 transition-all duration-75"
                    style={{ width: `${hud.fishing.reelProgress}%` }}
                  />
                </div>
              </>
            )}

            {/* Status Message & Primary Fishing Action Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold text-amber-200 truncate">
                {hud.fishing.messageMm}
              </div>

              {hud.fishing.rodLevel === 0 ? (
                <button
                  onClick={() => controllerRef.current?.buyOrUpgradeFishingGear()}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 border-2 border-white text-slate-950 font-extrabold text-xs cursor-pointer shadow-lg"
                >
                  🛒 ဝါးငါးမျှားတံ ဝယ်မည် (30,000 MMK)
                </button>
              ) : (
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    controllerRef.current?.setFishingReelHeld(true);
                    controllerRef.current?.fishingActionTap();
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    controllerRef.current?.setFishingReelHeld(false);
                  }}
                  onPointerCancel={() => controllerRef.current?.setFishingReelHeld(false)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-lg border-2 font-extrabold text-xs cursor-pointer touch-none shadow-lg active:scale-95 transition-transform ${
                    hud.fishing.phase === 'bite'
                      ? 'bg-amber-400 border-white text-slate-950 animate-bounce'
                      : hud.fishing.phase === 'reeling'
                        ? 'bg-emerald-500 border-white text-slate-950'
                        : 'bg-sky-600 hover:bg-sky-500 border-sky-200 text-white'
                  }`}
                >
                  {hud.fishing.phase === 'waiting'
                    ? '🌊 စောင့်နေသည်...'
                    : hud.fishing.phase === 'bite'
                      ? '⚡ ငါးဆွဲတင်မည်! [SPACE]'
                      : hud.fishing.phase === 'reeling'
                        ? '🎣 ဖိထား၍ ဆွဲတင်ပါ! (HOLD)'
                        : '🎣 ငါးမျှားတံ ပစ်ချမည်'}
                </button>
              )}
            </div>
          </div>
        )}
        {hud.notification && (
          <div className="bg-[#111f24]/95 border border-emerald-500/50 rounded-md px-3 py-1 text-center shadow-lg">
            <div className="text-[11px] font-bold text-emerald-300 truncate">
              {hud.notification.title}
            </div>
            {hud.notification.subtitle && (
              <div className="text-[10px] text-slate-300 truncate">
                {hud.notification.subtitle}
              </div>
            )}
          </div>
        )}
        {hud.nearInteractable && !hud.isManauDancing && (
          <button
            onClick={() => controllerRef.current?.triggerActionAttack()}
            className="pointer-events-auto bg-[#0b1318]/95 border-2 border-amber-400 rounded-md px-3 py-1 text-[11px] font-bold text-amber-300 shadow-lg cursor-pointer"
          >
            ★ {hud.nearInteractable.labelMm}
          </button>
        )}
        {hud.nearVehicle && !isDriving && (
          <button
            onClick={() => controllerRef.current?.toggleEnterExitVehicle()}
            className="pointer-events-auto bg-[#0b1318]/95 border border-amber-400/80 rounded-md px-3 py-1 text-[11px] font-semibold text-amber-300 shadow-lg cursor-pointer"
          >
            စီးရန် နှိပ်ပါ — {hud.nearVehicle.label}
          </button>
        )}
      </div>

      {/* ===========================================================================
          SATELLITE-REFERENCED 3D RADAR / LIVE GOOGLE SATELLITE MINIMAP
         =========================================================================== */}
      {showMinimap && (
        <div
          onClick={() => setFullMapOpen(true)}
          title="နှိပ်၍ Google Satellite မြေပုံအပြည့်နှင့် နာမည်ကြီးဆိုင်များ ကြည့်ရန်"
          className={`fixed top-9 right-2.5 z-20 ${
            isCompactLandscape ? 'w-[100px] h-[100px]' : 'w-32 h-32 sm:w-36 sm:h-36'
          } rounded-xl bg-[#071115]/95 border-2 border-emerald-500/60 overflow-hidden shadow-2xl pointer-events-auto cursor-pointer`}
        >
          {minimapMode === 'satellite' ? (
            <GoogleSatelliteMap
              hud={hud}
              mode="mini"
              selectedBuilding={selectedBuilding}
              onSelectBuilding={setSelectedBuilding}
              onSetWaypoint={(x, z, label) => controllerRef.current?.setWaypoint(x, z, label)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                perspective: hud.cameraMode === 'overhead' ? 'none' : '240px',
              }}
            >
              <svg
                viewBox={
                  hud.cameraMode === 'overhead'
                    ? `${hud.playerX - 150} ${hud.playerZ - 150} 300 300`
                    : `${hud.playerX - 200} ${hud.playerZ - 200} 400 400`
                }
                className="w-[125%] h-[125%] shrink-0"
                style={{
                  transform:
                    hud.cameraMode === 'overhead'
                      ? 'none'
                      : `rotateX(36deg) rotateZ(${radarRotationDeg}deg)`,
                  transformOrigin: 'center center',
                }}
              >
                {/* Alluvial Plain & Sitapu Quarter Background */}
                <rect x="-2200" y="-2200" width="4400" height="4400" fill="#183824" />

                {/* Sitapu Manau Park Circular Plaza at (0, 0) */}
                <circle
                  cx="0"
                  cy="0"
                  r="34"
                  fill="#5c241f"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                />

                {/* Roads and building footprints near the player (memoized; see radarLayers) */}
                {radarLayers}

                {/* Mandalay-Myitkyina Railway Tracks (South-West x = -136) */}
                <line
                  x1="-136"
                  y1="345"
                  x2="-136"
                  y2="460"
                  stroke="#a16207"
                  strokeWidth="5"
                  strokeDasharray="6 6"
                />

                {/* Ayeyarwady River */}
                <path d={RIVER_POLYGON_PATH} fill="#0284c7" />

                {/* Traffic Light Intersections (မီးပွိုင့်များ) */}
                {MYITKYINA_TRAFFIC_LIGHTS.map((tl) => (
                  <circle
                    key={tl.id}
                    cx={tl.x}
                    cy={tl.z}
                    r="4"
                    fill="#22c55e"
                    stroke="#090d16"
                    strokeWidth="1.5"
                  />
                ))}

                {/* 3D Building Footprints for All 10 Famous Myitkyina Shops, Hotels & University */}
                {MYITKYINA_FAMOUS_BUILDINGS.map((b) => (
                  <g key={b.id} transform={`translate(${b.x}, ${b.z})`}>
                    <rect
                      x={-b.width / 2 + 2}
                      y={-b.depth / 2 + 2}
                      width={b.width}
                      height={b.depth}
                      rx="2"
                      fill="#020617"
                      opacity="0.7"
                    />
                    <rect
                      x={-b.width / 2}
                      y={-b.depth / 2}
                      width={b.width}
                      height={b.depth}
                      rx="2"
                      fill={b.color}
                      stroke={b.accentColor}
                      strokeWidth="2"
                    />
                  </g>
                ))}

                {/* Major Landmarks */}
                {MYITKYINA_LANDMARKS.map((lm) => (
                  <circle
                    key={lm.id}
                    cx={lm.x}
                    cy={lm.z}
                    r="7.5"
                    fill={lm.color}
                    stroke="#ffffff"
                    strokeWidth="1.8"
                  />
                ))}

                {/* Active Jade, Vehicles & Enemies */}
                {hud.minimapEntities.map(
                  (ent) =>
                    ent.active && (
                      <circle
                        key={ent.id}
                        cx={ent.x}
                        cy={ent.z}
                        r={ent.type === 'jade' ? 4.5 : ent.type === 'enemy' ? 5.5 : 4.5}
                        fill={
                          ent.type === 'jade'
                            ? '#10b981'
                            : ent.type === 'enemy'
                              ? '#ef4444'
                              : '#facc15'
                        }
                      />
                    ),
                )}

                {/* Dashed GPS Navigation Route Line */}
                <line
                  x1={hud.playerX}
                  y1={hud.playerZ}
                  x2={hud.waypointX}
                  y2={hud.waypointZ}
                  stroke="#34d399"
                  strokeWidth="4.5"
                  strokeDasharray="8 6"
                />
                <circle
                  cx={hud.waypointX}
                  cy={hud.waypointZ}
                  r="9"
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                />

                {/* Player Heading Cone & Position Marker */}
                <g
                  transform={`translate(${hud.playerX}, ${hud.playerZ}) rotate(${playerArrowDeg})`}
                >
                  <polygon
                    points="0,-38 -22,-6 22,-6"
                    fill="#34d399"
                    fillOpacity="0.28"
                  />
                  <polygon
                    points="0,-12 -8,9 0,5 8,9"
                    fill="#ffffff"
                    stroke="#059669"
                    strokeWidth="2"
                  />
                </g>
              </svg>
            </div>
          )}

          {/* Top Badge & GPS Distance Overlay */}
          <div className="absolute top-1 left-1.5 px-1.5 py-0.5 rounded bg-black/80 border border-white/15 text-[8px] font-bold text-amber-300">
            {playerGeo.lat.toFixed(3)}°N, {playerGeo.lng.toFixed(3)}°E
          </div>
          <div className="absolute bottom-0 inset-x-0 bg-black/85 px-1.5 py-0.5 flex items-center justify-between text-[9px] font-semibold text-emerald-300">
            <span className="truncate">{hud.waypointLabelMm}</span>
            <span className="font-mono-tabular text-white shrink-0 ml-1">{distToWaypoint}m</span>
          </div>
        </div>
      )}

      {/* LEFT THUMB ZONE: ULTRA-SMOOTH 360° ANALOG JOYSTICK (ZERO REACT RE-RENDER LAG) */}
      {touchPadEnabled && (
        <div className="fixed bottom-2 left-3 z-20 flex flex-col items-center pointer-events-auto">
          <div
            ref={stickBaseRef}
            onPointerDown={handleStickDown}
            onPointerMove={handleStickMove}
            onPointerUp={handleStickUp}
            onPointerCancel={handleStickUp}
            onTouchStart={handleStickTouchStart}
            onTouchMove={handleStickTouchMove}
            onTouchEnd={handleStickTouchEnd}
            onTouchCancel={handleStickTouchEnd}
            className={`relative ${stickSizeClass} rounded-full bg-[#0b1318]/85 border-2 border-emerald-500/60 flex items-center justify-center shadow-xl touch-none cursor-pointer`}
            aria-label="Virtual Movement Joystick"
          >
            {/* Directional Guide Chevrons (Forward / Backward / Left / Right) */}
            <span className="absolute top-1.5 text-[9px] font-bold text-emerald-400/75 pointer-events-none">
              ▲
            </span>
            <span className="absolute bottom-1.5 text-[9px] font-bold text-emerald-400/75 pointer-events-none">
              ▼
            </span>
            <span className="absolute left-2 text-[9px] font-bold text-emerald-400/75 pointer-events-none">
              ◀
            </span>
            <span className="absolute right-2 text-[9px] font-bold text-emerald-400/75 pointer-events-none">
              ▶
            </span>

            <div className="w-1/2 h-1/2 rounded-full border border-white/15 pointer-events-none" />
            <div
              ref={stickKnobRef}
              className={`${knobSizeClass} rounded-full bg-emerald-500/95 border-2 border-white shadow-md pointer-events-none will-change-transform`}
            />
          </div>
        </div>
      )}

      {/* RIGHT THUMB ZONE: GTA-STYLE CONTEXTUAL ACTION / DRIVING PEDALS */}
      {touchPadEnabled && (
        <div className="fixed bottom-2 right-3 z-20 grid grid-cols-2 gap-1.5 pointer-events-auto">
          {isDriving ? (
            <>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualThrottle(1);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualThrottle(0);
                }}
                onPointerCancel={() => controllerRef.current?.setVirtualThrottle(0)}
                className={`${actionBtnClass} rounded-xl bg-emerald-600 active:bg-emerald-500 border border-emerald-300/60 text-white font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                လီဗာ (Gas)
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualThrottle(-1);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualThrottle(0);
                }}
                onPointerCancel={() => controllerRef.current?.setVirtualThrottle(0)}
                className={`${actionBtnClass} rounded-xl bg-amber-600 active:bg-amber-500 border border-amber-300/60 text-white font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                နောက်ဆုတ်
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualJumpBrake(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualJumpBrake(false);
                }}
                onPointerCancel={() => controllerRef.current?.setVirtualJumpBrake(false)}
                className={`${actionBtnClass} rounded-xl bg-rose-600 active:bg-rose-500 border border-rose-300/60 text-white font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                ဘရိတ်အုပ်
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.toggleEnterExitVehicle();
                }}
                className={`${actionBtnClass} rounded-xl bg-slate-800 active:bg-slate-700 border border-white/30 text-slate-100 font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                ယာဉ်ဆင်း [F]
              </button>
            </>
          ) : (
            <>
              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (hud.fishing.active) {
                    controllerRef.current?.setFishingReelHeld(true);
                    controllerRef.current?.fishingActionTap();
                  } else {
                    controllerRef.current?.triggerActionAttack();
                  }
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  if (hud.fishing.active) {
                    controllerRef.current?.setFishingReelHeld(false);
                  }
                }}
                onPointerCancel={() => {
                  if (hud.fishing.active) {
                    controllerRef.current?.setFishingReelHeld(false);
                  }
                }}
                className={`${actionBtnClass} rounded-xl bg-amber-600 active:bg-amber-500 border border-amber-300/60 text-white font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                {hud.fishing.active
                  ? hud.fishing.rodLevel === 0
                    ? '🛒 ငါးမျှားတံဝယ်'
                    : hud.fishing.phase === 'reeling'
                      ? '🎣 ဖိဆွဲပါ'
                      : '🎣 ငါးမျှား'
                  : hud.isManauDancing
                    ? '💃 အကရပ်မည်'
                    : hud.nearInteractable?.id === 'manau_dance'
                      ? '💃 မနောကမည်'
                      : hud.nearInteractable?.id === 'pagoda_pray'
                        ? '🙏 ဘုရားရှိခိုး'
                        : hud.nearInteractable
                          ? 'ဝင်မည် [E]'
                          : 'ဓားခုတ်/တီး'}
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualJumpBrake(true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.setVirtualJumpBrake(false);
                }}
                onPointerCancel={() => controllerRef.current?.setVirtualJumpBrake(false)}
                className={`${actionBtnClass} rounded-xl bg-sky-600 active:bg-sky-500 border border-sky-300/60 text-white font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                ခုန်ရန်
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  controllerRef.current?.toggleEnterExitVehicle();
                }}
                className={`${actionBtnClass} rounded-xl bg-emerald-700 active:bg-emerald-600 border border-emerald-400/60 text-white font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none`}
              >
                ဆိုင်ကယ်/ကား [F]
              </button>

              <button
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSprintLocked((s) => {
                    const next = !s;
                    controllerRef.current?.setVirtualStick(0, 0, next);
                    return next;
                  });
                }}
                className={`${actionBtnClass} rounded-xl border font-bold shadow-lg active:scale-95 transition-transform cursor-pointer touch-none ${
                  sprintLocked
                    ? 'bg-rose-600 border-rose-300 text-white'
                    : 'bg-slate-800/95 border-white/25 text-slate-200'
                }`}
              >
                {sprintLocked ? 'ပြေး ON' : 'အမြန်ပြေး'}
              </button>
            </>
          )}
        </div>
      )}

      {/* BOTTOM-CENTER COMPACT TRIGGER & POPUP DRAWER FOR SHOPS / FAST TRAVEL / VEHICLES */}
      <div className="fixed bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-auto">
        {drawerOpen && (
          <div className="mb-1.5 w-[92vw] max-w-xl bg-[#0b1318]/96 border border-white/20 rounded-xl p-2.5 shadow-2xl">
            <div className="flex items-center justify-between gap-1.5 border-b border-white/10 pb-1.5 mb-2 overflow-x-auto">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveDockTab('minigames')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer whitespace-nowrap ${
                    activeDockTab === 'minigames'
                      ? 'bg-sky-600 text-white'
                      : 'text-sky-300 hover:text-white'
                  }`}
                >
                  🎮 အလုပ် & ငါးဆိုင် (Earn MMK)
                </button>
                <button
                  onClick={() => setActiveDockTab('osm3d')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded cursor-pointer whitespace-nowrap ${
                    activeDockTab === 'osm3d'
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  🏙️ OSM 3D မြေပုံ ({hud.osm3d.buildingsCount + hud.osm3d.roadsCount})
                </button>
                <button
                  onClick={() => setActiveDockTab('shops')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                    activeDockTab === 'shops'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  နာမည်ကြီးဆိုင်များ (၁၁)
                </button>
                <button
                  onClick={() => setActiveDockTab('landmarks')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                    activeDockTab === 'landmarks'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  အထင်ကရနေရာများ
                </button>
                <button
                  onClick={() => setActiveDockTab('vehicles')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                    activeDockTab === 'vehicles'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ယာဉ်ခေါ်ယူရန်
                </button>
                <button
                  onClick={() => setActiveDockTab('world')}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer whitespace-nowrap ${
                    activeDockTab === 'world'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  အချိန်/ကင်မရာ
                </button>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-2 py-0.5 text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {activeDockTab === 'minigames' && (
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {/* Fishing Gear & Fish Shop Quick Actions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div className="p-2 rounded-lg bg-slate-900 border border-amber-400/50 flex flex-col justify-between gap-1.5">
                    <div>
                      <div className="text-[11px] font-bold text-amber-300">
                        🛠️ ငါးမျှားကိရိယာ ဆိုင် (Lv.{hud.fishing.rodLevel}/3)
                      </div>
                      <div className="text-[10px] text-slate-300">{hud.fishing.rodNameMm}</div>
                      <div className="text-[9px] text-slate-400">{hud.fishing.rodCapabilityMm}</div>
                    </div>
                    {hud.fishing.nextUpgradeCostMmk !== null ? (
                      <button
                        onClick={() => controllerRef.current?.buyOrUpgradeFishingGear()}
                        className="w-full py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] cursor-pointer"
                      >
                        {hud.fishing.rodLevel === 0
                          ? `🛒 အခြေခံ ဝါးငါးမျှားတံ ဝယ်မည် (${hud.fishing.nextUpgradeCostMmk.toLocaleString()} MMK)`
                          : `⬆️ Lv.${hud.fishing.rodLevel + 1} အဆင့်မြှင့်မည် (${hud.fishing.nextUpgradeCostMmk.toLocaleString()} MMK)`}
                      </button>
                    ) : (
                      <div className="text-[10px] font-bold text-emerald-400">
                        ✓ အမြင့်ဆုံး ပရို ငါးမျှားစက် (Lv.3 · 2.5x ဝင်ငွေ)
                      </div>
                    )}
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-emerald-400/50 flex flex-col justify-between gap-1.5">
                    <div>
                      <div className="text-[11px] font-bold text-emerald-300">
                        🐟 ဧရာဝတီ ငါးအဝယ်ဒိုင် (Fish Shop)
                      </div>
                      <div className="text-[10px] text-slate-200">
                        ပလိုင်းထဲရှိ ငါး: <strong>{hud.fishing.fishBasket.length}</strong> ကောင် ({hud.fishing.basketValueMmk.toLocaleString()} MMK)
                      </div>
                      <div className="text-[9px] text-slate-400">
                        ရောင်းပြီးစုစုပေါင်း: {hud.fishing.totalSoldCount} ကောင် · {hud.fishing.totalEarnedMmk.toLocaleString()} MMK
                      </div>
                    </div>
                    <button
                      onClick={() => controllerRef.current?.sellCaughtFish()}
                      disabled={hud.fishing.fishBasket.length === 0}
                      className={`w-full py-1 rounded font-extrabold text-[10px] ${
                        hud.fishing.fishBasket.length > 0
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      💰 ဖမ်းမိသောငါးများ ရောင်းမည် (+{hud.fishing.basketValueMmk.toLocaleString()} MMK)
                    </button>
                  </div>
                </div>

                {/* Jobs & Mini-Games Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  <button
                    onClick={() => {
                      controllerRef.current?.startFishingAtSpot('spot_balaminhtin');
                      setDrawerOpen(false);
                    }}
                    className="p-2 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-400/60 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-sky-300">
                      🌊 ကမ်းနားလမ်း မြောက် ငါးမျှား
                    </div>
                    <div className="text-[9px] text-amber-300">ငါးတန်ကြီးများ (1.4x ဈေးပိုရ)</div>
                  </button>

                  <button
                    onClick={() => {
                      controllerRef.current?.startFishingAtSpot('spot_sitapu_jetty');
                      setDrawerOpen(false);
                    }}
                    className="p-2 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-400/60 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-sky-300">
                      🛕 စေတီ ကမ်းနား ငါးမျှား
                    </div>
                    <div className="text-[9px] text-emerald-300">ငါးအဝယ်ဒိုင် အနီးဆုံးစခန်း</div>
                  </button>

                  <button
                    onClick={() => {
                      controllerRef.current?.startFishingAtSpot('spot_myitsone');
                      setDrawerOpen(false);
                    }}
                    className="p-2 rounded-lg bg-sky-950/90 hover:bg-sky-900 border border-sky-400/60 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-sky-300">
                      🌊 ကမ်းနားလမ်း တောင် ငါးမျှား
                    </div>
                    <div className="text-[9px] text-amber-300">ရှားပါးငါးကြီးများ (1.6x ဈေးပိုရ)</div>
                  </button>

                  <button
                    onClick={() => {
                      controllerRef.current?.startFoodDelivery();
                      setDrawerOpen(false);
                    }}
                    className="p-2 rounded-lg bg-rose-950/90 hover:bg-rose-900 border border-rose-400/60 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-rose-200">
                      🛵 ကချင်ထမင်းဟင်း ပို့ဆောင်ရေး
                    </div>
                    <div className="text-[9px] text-amber-300">ဝင်ငွေ +35,000 MMK</div>
                  </button>

                  <button
                    onClick={() => {
                      controllerRef.current?.startStreetTimeTrial();
                      setDrawerOpen(false);
                    }}
                    className="p-2 rounded-lg bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-400/60 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-indigo-200">
                      🏁 စီတာပူ ဆိုင်ကယ်ပြိုင်ပွဲ
                    </div>
                    <div className="text-[9px] text-amber-300">ဝင်ငွေ +45,000 MMK</div>
                  </button>

                  <button
                    onClick={() => {
                      controllerRef.current?.toggleManauDance();
                      setDrawerOpen(false);
                    }}
                    className="p-2 rounded-lg bg-amber-950/90 hover:bg-amber-900 border border-amber-400/60 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-bold text-amber-200">
                      💃 မနောအက သံစဉ်မစ်ရှင်
                    </div>
                    <div className="text-[9px] text-emerald-300">တစ်ချက် +2,500 MMK / မစ်ရှင် +35k</div>
                  </button>
                </div>
              </div>
            )}

            {activeDockTab === 'osm3d' && (
              <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-1">
                <div className="p-2 rounded-lg bg-slate-900 border border-emerald-400/50 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold text-emerald-300">
                      🏙️ {hud.osm3d.sourceName} — 3D ပြောင်းလဲပြီး!
                    </div>
                    <div className="text-[10px] text-slate-200">
                      3D အဆောက်အအုံ: <strong>{hud.osm3d.buildingsCount.toLocaleString()}</strong> လုံး · 3D လမ်းမနှင့် လမ်းသွယ်: <strong>{hud.osm3d.roadsCount.toLocaleString()}</strong> သွယ် · အနီး 150m ရှိ အဆောက်အအုံ: <strong className="text-amber-300">{hud.osm3d.nearbyBuildings150m}</strong> လုံး
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      onClick={() => {
                        controllerRef.current?.teleportToOsmCity();
                        setDrawerOpen(false);
                      }}
                      className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-extrabold cursor-pointer"
                    >
                      🏙️ မြို့လယ်သို့သွားမည်
                    </button>
                    <button
                      onClick={() => controllerRef.current?.toggleOverheadCamera()}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                        hud.cameraMode === 'overhead'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-amber-300 border border-amber-400/40'
                      }`}
                    >
                      🛰️ အပေါ်စီးကင်မရာ
                    </button>
                    <button
                      onClick={() => controllerRef.current?.toggleOsmDebugMode()}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                        hud.osm3d.debugMode
                          ? 'bg-cyan-400 text-slate-950'
                          : 'bg-slate-800 text-cyan-300 border border-cyan-400/40'
                      }`}
                    >
                      🔍 Debug Box
                    </button>
                    <button
                      onClick={() => controllerRef.current?.toggleOsm3DLayer()}
                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                        hud.osm3d.visible
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {hud.osm3d.visible ? '✓ 3D ON' : '3D OFF'}
                    </button>
                    <button
                      onClick={() => customOsmInputRef.current?.click()}
                      className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold cursor-pointer"
                    >
                      📂 .geojson တင်ရန်
                    </button>
                  </div>
                </div>

                {/* Collision-Safe Drivable OSM City Clusters */}
                <div className="text-[10px] font-bold text-amber-300">
                  🛣️ OSM 3D အဆောက်အအုံ အထူထပ်ဆုံး မြို့လယ်လမ်းမကြီးများ (Collision-Safe City Road Spawns):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {hud.osm3d.citySpawnPoints.map((sp, idx) => (
                    <div
                      key={sp.id}
                      className="p-2 rounded bg-slate-950 border border-emerald-400/40 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-emerald-300 truncate">
                          {sp.nameMm}
                        </div>
                        <div className="text-[9px] text-slate-300 truncate">
                          {sp.nameEn} · 150m အတွင်း အဆောက်အအုံ ({sp.buildingsNearby}) လုံး
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          controllerRef.current?.teleportToOsmCity(idx);
                          setDrawerOpen(false);
                        }}
                        className="shrink-0 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-[10px] cursor-pointer"
                      >
                        🏙️ သွားမည်
                      </button>
                    </div>
                  ))}
                </div>

                {/* Interactive Myitkyina NPCs Directory */}
                <div className="text-[10px] font-bold text-cyan-300 pt-1">
                  👥 မြစ်ကြီးနား NPC ဇာတ်ကောင်များ (Shopkeepers, Quest Givers & Citizens):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {MYITKYINA_INTERACTIVE_NPCS.map((npc) => (
                    <div
                      key={npc.id}
                      className="p-1.5 rounded bg-slate-900 border border-amber-400/30 flex flex-col justify-between gap-1"
                    >
                      <div>
                        <div className="text-[10px] font-bold text-amber-300 truncate">
                          {npc.nameMm}
                        </div>
                        <div className="text-[9px] text-slate-300 truncate">{npc.roleLabelMm}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            controllerRef.current?.interactWithNpc(npc.id);
                            setDrawerOpen(false);
                          }}
                          className="flex-1 px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[9px] font-extrabold cursor-pointer"
                        >
                          💬 စကားပြော
                        </button>
                        <button
                          onClick={() => {
                            controllerRef.current?.teleportToRegion(npc.x, npc.z + 4, npc.nameMm);
                            setDrawerOpen(false);
                          }}
                          className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[9px] cursor-pointer"
                        >
                          သွားမည်
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] font-bold text-emerald-300 pt-1">
                  📍 OpenStreetMap အထင်ကရ နေရာများ ({hud.osm3d.namedPlaces.length}):
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {hud.osm3d.namedPlaces.map((pl) => (
                    <div
                      key={pl.id}
                      className="p-1.5 rounded bg-slate-900/95 border border-white/10 flex flex-col justify-between gap-1"
                    >
                      <div>
                        <div className="text-[11px] font-bold text-emerald-300 truncate">
                          {pl.nameMm}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">
                          {pl.category} · {pl.lat}°N, {pl.lng}°E
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            controllerRef.current?.setWaypoint(pl.x, pl.z, pl.nameMm);
                            setDrawerOpen(false);
                          }}
                          className="flex-1 px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-[10px] font-semibold text-white cursor-pointer"
                        >
                          GPS မှတ်မည်
                        </button>
                        <button
                          onClick={() => {
                            controllerRef.current?.teleportToRegion(pl.x, pl.z + 8, pl.nameMm);
                            setDrawerOpen(false);
                          }}
                          className="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-[10px] font-bold text-white cursor-pointer"
                        >
                          3D သို့သွားမည်
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeDockTab === 'shops' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[28vh] overflow-y-auto pr-1">
                {MYITKYINA_FAMOUS_BUILDINGS.map((b) => (
                  <div
                    key={b.id}
                    className="p-1.5 rounded bg-slate-900/95 border border-white/10 flex flex-col justify-between gap-1"
                  >
                    <div>
                      <div className="text-[11px] font-bold text-amber-300 truncate">
                        {b.nameMm}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">{b.quarterMm}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          controllerRef.current?.setWaypoint(b.x, b.z, b.nameMm);
                          setDrawerOpen(false);
                        }}
                        className="flex-1 px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-[10px] font-semibold text-white cursor-pointer"
                      >
                        GPS မှတ်မည်
                      </button>
                      <button
                        onClick={() => {
                          controllerRef.current?.teleportToRegion(b.x, b.z + 10, b.nameMm);
                          setDrawerOpen(false);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                      >
                        သွားမည်
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeDockTab === 'landmarks' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[28vh] overflow-y-auto">
                {MYITKYINA_LANDMARKS.map((lm) => (
                  <button
                    key={lm.id}
                    onClick={() => {
                      controllerRef.current?.teleportToRegion(lm.x, lm.z + 16, lm.nameMm);
                      setDrawerOpen(false);
                    }}
                    className="px-2 py-1.5 rounded bg-slate-900 border border-white/10 hover:border-emerald-400 text-left cursor-pointer"
                  >
                    <div className="text-[11px] font-semibold text-emerald-300 truncate">
                      {lm.nameMm}
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">{lm.quarterMm}</div>
                  </button>
                ))}
              </div>
            )}

            {activeDockTab === 'vehicles' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  onClick={() => {
                    controllerRef.current?.summonVehicle('ebike');
                    setDrawerOpen(false);
                  }}
                  className="px-2.5 py-2 rounded bg-amber-500/20 border border-amber-400 text-[11px] font-bold text-amber-300 cursor-pointer"
                >
                  ဘက်ထရီဆိုင်ကယ် (AIMA)
                </button>
                <button
                  onClick={() => {
                    controllerRef.current?.summonVehicle('hilux4x4');
                    setDrawerOpen(false);
                  }}
                  className="px-2.5 py-2 rounded bg-slate-900 border border-white/15 text-[11px] font-semibold text-white cursor-pointer"
                >
                  4x4 တောင်ပေါ်ကား
                </button>
                <button
                  onClick={() => {
                    controllerRef.current?.summonVehicle('tuktuk');
                    setDrawerOpen(false);
                  }}
                  className="px-2.5 py-2 rounded bg-slate-900 border border-white/15 text-[11px] font-semibold text-white cursor-pointer"
                >
                  မြစ်ကြီးနား သုံးဘီး
                </button>
                <button
                  onClick={() => {
                    controllerRef.current?.summonVehicle('riverboat');
                    setDrawerOpen(false);
                  }}
                  className="px-2.5 py-2 rounded bg-slate-900 border border-white/15 text-[11px] font-semibold text-white cursor-pointer"
                >
                  ဧရာဝတီ စက်လှေ
                </button>
              </div>
            )}

            {activeDockTab === 'world' && (
              <div className="space-y-2">
                {/* Special Missions: Food Delivery & Street Time Trial */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => {
                      controllerRef.current?.startFoodDelivery();
                      setDrawerOpen(false);
                    }}
                    className="px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 border border-rose-300 text-[11px] font-bold text-white cursor-pointer"
                  >
                    ကချင်ထမင်းဟင်း ပို့ဆောင်ရေး (+35,000 MMK)
                  </button>
                  <button
                    onClick={() => {
                      controllerRef.current?.startStreetTimeTrial();
                      setDrawerOpen(false);
                    }}
                    className="px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 border border-emerald-300 text-[11px] font-bold text-white cursor-pointer"
                  >
                    စီတာပူ မြစ်ကမ်းဘေး ဆိုင်ကယ်ပြိုင်ပွဲ (+45,000 MMK)
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  {/* Time of Day */}
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['morning', 'နံနက်'],
                        ['noon', 'နေ့လယ်'],
                        ['sunset', 'ညနေ'],
                        ['night', 'ညချမ်း'],
                      ] as [TimeOfDay, string][]
                    ).map(([tod, label]) => (
                      <button
                        key={tod}
                        onClick={() => controllerRef.current?.setTimeOfDay(tod)}
                        className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          hud.timeOfDay === tod
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Myitkyina Weather System */}
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['clear', 'နေသာ'],
                        ['mist', 'ဆောင်းမြူနှင်း'],
                        ['rain', 'မိုးရွာ (ရေစိုလမ်း)'],
                      ] as [WeatherMode, string][]
                    ).map(([wMode, label]) => (
                      <button
                        key={wMode}
                        onClick={() => controllerRef.current?.setWeather(wMode)}
                        className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          hud.weather === wMode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Camera Mode */}
                  <div className="flex items-center gap-1">
                    {(
                      [
                        ['chase', 'အနီး'],
                        ['high', 'အမြင့်'],
                        ['overhead', '🛰️ မြို့ပြအပေါ်စီး'],
                        ['cinematic', 'ပတ်လည်'],
                      ] as [CameraMode, string][]
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        onClick={() => controllerRef.current?.setCameraMode(mode)}
                        className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
                          hud.cameraMode === mode
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-900 text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => setDrawerOpen((d) => !d)}
          className="px-3 py-1 bg-[#0b1318]/90 border border-white/15 rounded-full text-[10px] font-semibold text-slate-200 shadow-md cursor-pointer whitespace-nowrap"
        >
          {drawerOpen ? '▾ မီနူးပိတ်ရန်' : '▴ ဆိုင်များ / နေရာရွှေ့ / ယာဉ်ခေါ်ရန်'}
        </button>
      </div>

      {/* ===========================================================================
          INTERACTIVE FULL-SCREEN GOOGLE EARTH SATELLITE & 3D VECTOR MAP MODAL
         =========================================================================== */}
      {fullMapOpen && (
        <div className="fixed inset-0 z-40 bg-[#050b0e]/95 flex flex-col md:flex-row items-stretch justify-between p-2.5 sm:p-4 gap-3 pointer-events-auto overflow-hidden">
          {/* Left: Live Google Maps Satellite Hybrid View OR Scaled 3D Vector Blueprint */}
          <div className="relative flex-1 bg-[#091519] border border-emerald-500/40 rounded-xl overflow-hidden flex items-center justify-center min-h-[190px]">
            {fullMapMode === 'satellite' ? (
              <GoogleSatelliteMap
                hud={hud}
                mode="full"
                selectedBuilding={selectedBuilding}
                onSelectBuilding={setSelectedBuilding}
                onSetWaypoint={(x, z, label) => {
                  controllerRef.current?.setWaypoint(x, z, label);
                  setFullMapOpen(false);
                }}
                onTeleport={(x, z, label) => {
                  controllerRef.current?.teleportToRegion(x, z, label);
                  setFullMapOpen(false);
                }}
              />
            ) : (
              <svg viewBox={FULL_MAP_VIEWBOX} className="w-full h-full max-h-[88vh]">
                <rect
                  x={WORLD_BOUNDS.minX - 60}
                  y={WORLD_BOUNDS.minZ - 60}
                  width={WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX + 120}
                  height={WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ + 120}
                  fill="#0d1f17"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="34"
                  fill="#5c241f"
                  stroke="#f59e0b"
                  strokeWidth="3"
                />
                {/* All streets and building footprints (memoized; see fullMapLayers) */}
                {fullMapLayers}
                {/* Named OpenStreetMap 3D Buildings & Landmarks on Full Blueprint Map */}
                {hud.osm3d.namedPlaces.slice(0, 26).map((pl) => (
                  <g
                    key={pl.id}
                    transform={`translate(${pl.x}, ${pl.z})`}
                    onClick={() => {
                      controllerRef.current?.teleportToRegion(pl.x, pl.z + 8, pl.nameMm);
                      setFullMapOpen(false);
                    }}
                    className="cursor-pointer"
                  >
                    <circle r="7" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                    <text
                      x="0"
                      y="-11"
                      textAnchor="middle"
                      fill="#bae6fd"
                      fontSize="12"
                      fontWeight="700"
                    >
                      {pl.nameMm}
                    </text>
                  </g>
                ))}
                <path d={RIVER_POLYGON_PATH} fill="#0284c7" />
                {MYITKYINA_TRAFFIC_LIGHTS.map((tl) => (
                  <circle
                    key={tl.id}
                    cx={tl.x}
                    cy={tl.z}
                    r="5"
                    fill="#22c55e"
                    stroke="#090d16"
                    strokeWidth="1.5"
                  />
                ))}
                <line
                  x1={hud.playerX}
                  y1={hud.playerZ}
                  x2={hud.waypointX}
                  y2={hud.waypointZ}
                  stroke="#34d399"
                  strokeWidth="6"
                  strokeDasharray="12 8"
                />
                {MYITKYINA_FAMOUS_BUILDINGS.map((b) => {
                  const isSel = selectedBuilding?.id === b.id;
                  return (
                    <g
                      key={b.id}
                      transform={`translate(${b.x}, ${b.z})`}
                      onClick={() => setSelectedBuilding(b)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={-b.width / 2 - (isSel ? 5 : 0)}
                        y={-b.depth / 2 - (isSel ? 5 : 0)}
                        width={b.width + (isSel ? 10 : 0)}
                        height={b.depth + (isSel ? 10 : 0)}
                        rx="3"
                        fill={b.color}
                        stroke={isSel ? '#ffffff' : b.accentColor}
                        strokeWidth={isSel ? 4 : 2.5}
                      />
                      <text
                        x="0"
                        y={-b.depth / 2 - 8}
                        textAnchor="middle"
                        fill="#fef08a"
                        fontSize="14"
                        fontWeight="700"
                      >
                        {b.nameMm}
                      </text>
                    </g>
                  );
                })}
                <g transform={`translate(${hud.playerX}, ${hud.playerZ})`}>
                  <circle r="16" fill="#10b981" fillOpacity="0.35" />
                  <circle r="8" fill="#ffffff" stroke="#059669" strokeWidth="3" />
                </g>
              </svg>
            )}

            {/* Top Left Header & Mode Toggle inside Map Container */}
            <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="bg-slate-950/90 border border-white/20 rounded-lg px-2.5 py-1 pointer-events-auto">
                <div className="text-xs font-bold text-emerald-400">
                  မြစ်ကြီးနား ဂြိုဟ်တုမြေပုံ · MYITKYINA GOOGLE SATELLITE & 3D MAP
                </div>
                <div className="text-[10px] text-slate-300">
                  သင့်တည်နေရာ: {playerGeo.lat}°N, {playerGeo.lng}°E · မြေပုံပေါ်နှိပ်၍ GPS လမ်းညွှန်မှတ်နိုင်သည်
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-950/90 border border-white/20 rounded-lg p-1 pointer-events-auto">
                <button
                  onClick={() => setFullMapMode('satellite')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    fullMapMode === 'satellite'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Google Satellite (ဂြိုဟ်တုပုံ)
                </button>
                <button
                  onClick={() => setFullMapMode('vector')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    fullMapMode === 'vector'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  3D Blueprint (ဂိမ်းမြေပုံ)
                </button>
              </div>
            </div>
          </div>

          {/* Right: Famous Shops, Restaurants, Hotels & Landmarks Directory */}
          <div className="w-full md:w-80 lg:w-96 bg-[#0b1418] border border-white/15 rounded-xl p-3 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">
                  နာမည်ကြီးဆိုင်များနှင့် အထင်ကရနေရာများ
                </h3>
                <p className="text-[10px] text-emerald-400">
                  Google Maps အမှန်တကယ် တည်နေရာများအတိုင်း ချိတ်ဆက်ထားသည်
                </p>
              </div>
              <button
                onClick={() => setFullMapOpen(false)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                ✕ ပိတ်မည်
              </button>
            </div>

            {/* Selected Building Spotlight */}
            {selectedBuilding && (
              <div className="mb-2 p-2.5 rounded-lg bg-slate-900/95 border border-amber-400/50 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300 truncate">
                    {selectedBuilding.nameMm}
                  </span>
                  <span className="text-[9px] font-mono-tabular px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 shrink-0">
                    {selectedBuilding.lat.toFixed(4)}°N, {selectedBuilding.lng.toFixed(4)}°E
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  {selectedBuilding.quarterMm}
                </div>
                {selectedBuilding.buffDescriptionMm && (
                  <div className="text-[10px] text-emerald-300 mt-0.5">
                    ✦ {selectedBuilding.buffDescriptionMm}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      controllerRef.current?.setWaypoint(
                        selectedBuilding.x,
                        selectedBuilding.z,
                        selectedBuilding.nameMm,
                      );
                      setFullMapOpen(false);
                    }}
                    className="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold text-white cursor-pointer"
                  >
                    GPS လမ်းညွှန်မှတ်ရန်
                  </button>
                  <button
                    onClick={() => {
                      controllerRef.current?.teleportToRegion(
                        selectedBuilding.x,
                        selectedBuilding.z + 10,
                        selectedBuilding.nameMm,
                      );
                      setFullMapOpen(false);
                    }}
                    className="flex-1 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-[11px] font-bold text-white cursor-pointer"
                  >
                    တိုက်ရိုက်သွားရန်
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable List of All 10 Famous Buildings */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {MYITKYINA_FAMOUS_BUILDINGS.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBuilding(b)}
                  className={`p-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    selectedBuilding?.id === b.id
                      ? 'bg-emerald-950/60 border-emerald-400'
                      : 'bg-slate-900/80 border-white/10 hover:border-white/30'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">{b.nameMm}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {b.quarterMm} ·{' '}
                      <span className="text-amber-300 font-mono-tabular">
                        {b.lat.toFixed(3)}°N
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        controllerRef.current?.setWaypoint(b.x, b.z, b.nameMm);
                        setFullMapOpen(false);
                      }}
                      className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-[10px] font-semibold text-white cursor-pointer"
                    >
                      GPS
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        controllerRef.current?.teleportToRegion(b.x, b.z + 10, b.nameMm);
                        setFullMapOpen(false);
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                    >
                      သွားမည်
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PAUSE / VICTORY / GAME OVER MODAL */}
      {(hud.phase === 'paused' || hud.phase === 'victory' || hud.phase === 'gameover') && (
        <div className="fixed inset-0 z-30 bg-[#050a08]/90 flex items-center justify-center p-3 pointer-events-auto overflow-y-auto">
          <div className="bg-[#0d171c] border border-white/15 rounded-xl max-w-md w-full p-4 shadow-2xl my-auto">
            <h2 className="text-lg font-bold font-display text-white mb-1">
              {hud.phase === 'victory'
                ? 'မြစ်ကြီးနား မစ်ရှင်အားလုံး အောင်မြင်ပြီ! · Victory!'
                : hud.phase === 'gameover'
                  ? 'ခရီးစဉ် ရပ်နားသွားပါပြီ · Expedition Ended'
                  : 'ဂိမ်းခေတ္တရပ်ထားသည် · Game Paused'}
            </h2>

            <div className="space-y-1.5 my-3 max-h-[42vh] overflow-y-auto pr-1">
              {hud.quests.map((q) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900/90 border border-white/10 text-[11px]"
                >
                  <span className="font-medium text-slate-100 truncate mr-2">{q.titleMm}</span>
                  <span className="font-mono-tabular font-bold text-emerald-400 shrink-0">
                    {q.completed ? 'ပြီးစီး ✓' : `${q.progress}/${q.goal}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => setSettingsOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-white/15 cursor-pointer"
              >
                ⚙ ဆက်တင်
              </button>
              <button
                onClick={() => setTutorialOpen(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-white/15 cursor-pointer"
              >
                🎮 ကစားနည်း
              </button>
              <button
                onClick={() => controllerRef.current?.toggleMute()}
                className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs rounded-lg border border-white/15 cursor-pointer"
              >
                {hud.isMuted ? 'အသံဖွင့်' : 'အသံပိတ်'}
              </button>
              {hud.phase === 'paused' && (
                <button
                  onClick={() => {
                    controllerRef.current?.saveNow();
                    setSaveSummary(getSaveSummary());
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-500/30 cursor-pointer"
                >
                  💾 သိမ်းမည် · Save
                </button>
              )}
              {hud.phase === 'gameover' && saveSummary && (
                <button
                  onClick={() => controllerRef.current?.continueGame()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  💾 နောက်ဆုံးသိမ်းထားချက်မှ ဆက်မည်
                </button>
              )}
              {hud.phase !== 'gameover' && (
                <button
                  onClick={() => controllerRef.current?.resumeGame()}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  ဆက်ကစားမည် · Resume
                </button>
              )}
              <button
                onClick={() => {
                  if (hud.phase !== 'victory' && saveSummary && !confirmRestart) {
                    setConfirmRestart(true);
                    return;
                  }
                  controllerRef.current?.restartGame();
                }}
                className={`px-4 py-1.5 ${
                  confirmRestart
                    ? 'bg-red-700 hover:bg-red-600 border-red-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 border-white/15'
                } text-slate-200 text-xs font-semibold rounded-lg border cursor-pointer`}
              >
                {confirmRestart ? '⚠️ သိမ်းထားချက် ပျက်မည် — ထပ်နှိပ်ပါ' : 'အစမှပြန်စမည်'}
              </button>
            </div>
          </div>
        </div>
      )}
      {overlayModals}
    </div>
  );
};
