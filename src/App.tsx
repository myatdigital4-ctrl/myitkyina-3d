/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { GameControllerActions, MyitkyinaCanvas } from './components/MyitkyinaCanvas';
import {
  DEFAULT_OSM_CITY_SPAWNS,
  HUDState,
  INITIAL_QUESTS,
  MYITKYINA_LANDMARKS,
} from './types/game';

const INITIAL_HUD: HUDState = {
  phase: 'title',
  health: 100,
  maxHealth: 100,
  stamina: 100,
  jadeCount: 50000,
  totalJadeInWorld: 0,
  score: 0,
  meritLevel: 1,
  currentRegion: MYITKYINA_LANDMARKS[0],
  activeVehicle: 'none',
  nearVehicle: null,
  nearInteractable: null,
  speedKmh: 0,
  playerX: 0,
  playerZ: 36,
  playerHeading: Math.PI,
  cameraYaw: Math.PI,
  waypointX: 0,
  waypointZ: 0,
  waypointLabelMm: 'စီတာပူ မနောတိုင် စည်တော် (၄) ခု တီးခတ်ပါ',
  quests: INITIAL_QUESTS,
  activeQuestIndex: 0,
  enemiesRemaining: 8,
  totemsActivated: 0,
  timeOfDay: 'morning',
  weather: 'clear',
  activeChallenge: null,
  cameraMode: 'chase',
  isMuted: false,
  notification: null,
  minimapEntities: [],
  comboCount: 0,
  isManauDancing: false,
  manauRhythm: {
    active: false,
    hitsCompleted: 0,
    hitsGoal: 8,
    streak: 0,
    currentBeatKey: 'left',
    beatProgress: 0,
    upcomingQueue: ['right', 'up', 'down'],
    lastRating: null,
    lastRatingTextMm: 'သံစဉ်စည်းချက်အလိုက် ခလုတ်နှိပ်ပါ!',
    questCompleted: false,
  },
  fishing: {
    active: false,
    spotNameMm: 'ကမ်းနားလမ်း ငါးမျှားဆိပ်',
    phase: 'no_gear',
    rodLevel: 0,
    rodNameMm: 'ငါးမျှားကိရိယာ မရှိသေးပါ (No Fishing Gear)',
    rodCapabilityMm: 'ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) အရင်ဝယ်ယူရပါမည်',
    nextUpgradeCostMmk: 30000,
    nextUpgradeNameMm: 'အခြေခံ ဝါးငါးမျှားတံ (Budget Bamboo Rod)',
    fishPosition: 50,
    barPosition: 50,
    barHalfWidth: 13,
    reelProgress: 0,
    totalCaught: 0,
    totalSoldCount: 0,
    totalEarnedMmk: 0,
    biggestKg: 0,
    lastCatch: null,
    fishBasket: [],
    basketValueMmk: 0,
    caughtSpecies: [],
    messageMm: '🛒 ငါးမမျှားမီ အခြေခံ ဝါးငါးမျှားတံ (30,000 MMK) ကို အရင်ဝယ်ယူပါ!',
  },
  musicTrack: 'off',
  musicTrackLabel: 'သီချင်းပိတ်ထားသည် (Music Off)',
  hasCustomSong: false,
  osm3d: {
    loaded: false,
    visible: true,
    debugMode: false,
    sourceName: 'Myitkyina OpenStreetMap (export.geojson)',
    buildingsCount: 0,
    roadsCount: 0,
    nearbyBuildings150m: 2,
    nearestRoadName: 'Pyi Htaung Su Road (ပြည်ထောင်စုလမ်းမကြီး)',
    nearestRoadDistM: 12,
    bbox: {
      minLat: 25.3448,
      maxLat: 25.4253,
      minLng: 97.3537,
      maxLng: 97.4456,
      minX: -855.9,
      maxX: 660.7,
      minZ: -422.1,
      maxZ: 1028.5,
    },
    citySpawnPoints: DEFAULT_OSM_CITY_SPAWNS,
    namedPlaces: [],
    roadPolylines: [],
    buildingFootprints: [],
  },
  activeNpcDialogue: null,
};

export default function App() {
  const [hudState, setHudState] = useState<HUDState>(INITIAL_HUD);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const controllerRef = useRef<GameControllerActions | null>(null);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const handleHudUpdate = useCallback((nextState: HUDState) => {
    setHudState(nextState);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#080d0b]">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <MyitkyinaCanvas onHudUpdate={handleHudUpdate} controllerRef={controllerRef} />
      <GameHUD hud={hudState} controllerRef={controllerRef} />
    </main>
  );
}
