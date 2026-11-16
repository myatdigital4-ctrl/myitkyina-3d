# Myitkyina: Emerald Confluence (မြစ်ကြီးနား Open World)

A 3D open-world exploration game set in Myitkyina, Kachin State, built with React, Three.js and Vite. Walk, ride an e-bike, drive a 4x4 or take a riverboat around Manau Park, Balaminhtin Bridge, the Ayeyarwady riverfront and the Myitsone Confluence.

It runs in the browser on desktop and phones (landscape), and installs as a PWA.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Production build into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Type-check with `tsc --noEmit` |

### Optional: Google satellite map

The in-game satellite minimap uses Google Maps. Copy `.env.example` to `.env.local` and set:

```
VITE_GOOGLE_MAPS_API_KEY="your key"
```

Without a key the game still works and uses the built-in 3D radar map.

## Controls

| Keyboard | Touch | Action |
| --- | --- | --- |
| W A S D / arrows | Left joystick | Move / drive |
| Shift | Push joystick to edge | Sprint |
| Space | Jump button | Jump / brake |
| Mouse drag | Swipe right side of screen | Look around |
| E | Talk / hit button | Talk, drum, fish, attack |
| F | Vehicle button | Get in / out of vehicle |
| N | Map button | Full map |
| H | Menu button | Mini-games, shops, landmarks |
| C / R | — | Change camera / reset camera |
| M | — | Mute |
| Esc | ⏸ | Pause, save, settings |

The controls guide opens automatically the first time you play and is available any time from the pause menu (🎮 ကစားနည်း).

## Map (1:1 scale)

The world is a 3 km × 3 km area of real downtown Myitkyina at real-world scale (1 unit = 1 m), centered near the railway station, with the Ayeyarwady on the east side.

It is generated from the OpenStreetMap export in `public/assets/aistudio/export.geojson`:

```bash
npm run map:build
```

Optionally, it also merges **Microsoft Global ML Building Footprints** from `data/microsoft-buildings/*.csv.gz`, which raises the area from 366 to ~10,000 buildings (OSM is used where both map the same building). That folder is not in git; download the Myitkyina tile with:

```bash
mkdir -p data/microsoft-buildings && curl -o data/microsoft-buildings/myanmar_132023030.csv.gz "https://minedbuildings.z5.web.core.windows.net/global-buildings/2026-02-03/global-buildings.geojsonl/RegionName=Myanmar/quadkey=132023030/part-00119-4feead82-d499-422b-94cb-c036c212127a.c000.csv.gz"
```

(Google Open Buildings v3 does not cover Myitkyina.) Microsoft's data has no heights here, so building heights are estimated from footprint size.

This writes:

- `public/assets/map/myitkyina-core.geojson`: buildings and streets clipped to the play area (loaded by the game)
- `src/world/mapData.generated.ts`: projection, bounds, river line, drivable street segments, named places and empty plots

Game buildings, NPCs, missions, fishing spots and traffic are placed from that data (`src/world/worldLayout.ts`), so they land on real streets and empty plots. To change the area or river line, edit the constants at the top of `scripts/build-map-data.mjs` and rerun the command.

**Known approximations:** the Ayeyarwady's banks are estimated from where the streets stop (the export has no water data), Strand Road is added along that estimated bank, and the Manau plaza sits on an open lot near the station rather than its exact real location. Balaminhtin Bridge, Myitsone and Jaw Bum are outside the 3 km area.

## Settings

⚙ in the top bar, title screen or pause menu. Saved per device in the browser:

- **Graphics quality** — Low / Medium / High (resolution, shadows, view distance). Use Low on older phones.
- **Music and sound-effect volume**
- **Camera look sensitivity** and inverted vertical look
- **Show FPS**

## Project layout

```
src/
  App.tsx                     Root: canvas + HUD
  components/
    MyitkyinaCanvas.tsx       Three.js world, game loop, input, quests
    GameHUD.tsx               All on-screen UI
    SettingsPanel.tsx         Settings dialog
    ControlsTutorial.tsx      How-to-play guide
    GoogleSatelliteMap.tsx    Satellite minimap
  world/                      Terrain, buildings, OSM city builder, NPCs/traffic
  audio/soundEngine.ts        Procedural music and sound effects (Web Audio)
  save/saveSystem.ts          Autosave / continue (localStorage)
  settings/gameSettings.ts    Player settings and graphics quality profiles
  types/game.ts               Game data: projection, landmarks, quests, fish, shops
  world/mapData.generated.ts  Generated from OSM by scripts/build-map-data.mjs
  world/worldLayout.ts        Place things on real streets and empty plots
public/assets/aistudio/       OpenStreetMap export and reference images
```

### Adding a quest

1. Add an entry to `INITIAL_QUESTS` in `src/types/game.ts` with a unique `id`.
2. In `MyitkyinaCanvas.tsx`, find it with `sim.quests.find((q) => q.id === 'your_id')`, raise `progress`, and when it reaches `goal` set `completed`, add `rewardJade` to `sim.jadeCount` and call `showBanner(...)`.

Saved games pick up new quests automatically (progress is merged by `id`).

## Data credits

- Streets, named places and some buildings: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
- Building footprints: [Microsoft Global ML Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints), ODbL.
