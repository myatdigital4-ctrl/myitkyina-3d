import React, { useEffect, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  FamousBuildingInfo,
  HUDState,
  latLngToWorld,
  MYITKYINA_FAMOUS_BUILDINGS,
  MYITKYINA_LANDMARKS,
  worldToLatLng,
} from '../types/game';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Helper child component that smoothly pans the mini satellite map to follow the player
const MapCameraFollower: React.FC<{ lat: number; lng: number; follow: boolean }> = ({
  lat,
  lng,
  follow,
}) => {
  const map = useMap();
  useEffect(() => {
    if (map && follow) {
      map.panTo({ lat, lng });
    }
  }, [map, lat, lng, follow]);
  return null;
};

interface SatelliteMapProps {
  hud: HUDState;
  mode: 'mini' | 'full';
  selectedBuilding: FamousBuildingInfo | null;
  onSelectBuilding?: (b: FamousBuildingInfo) => void;
  onSetWaypoint?: (x: number, z: number, labelMm: string) => void;
  onTeleport?: (x: number, z: number, labelMm: string) => void;
}

export const GoogleSatelliteMap: React.FC<SatelliteMapProps> = ({
  hud,
  mode,
  selectedBuilding,
  onSelectBuilding,
  onSetWaypoint,
}) => {
  const [mapType, setMapType] = useState<'hybrid' | 'satellite' | 'roadmap'>('hybrid');
  const playerGeo = worldToLatLng(hud.playerX, hud.playerZ);
  const waypointGeo = worldToLatLng(hud.waypointX, hud.waypointZ);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#091519] text-slate-300 text-xs p-3 text-center">
        Google Maps Satellite Key ချိတ်ဆက်ထားခြင်း မရှိသေးပါ။
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} region="MM" language="my">
      <div className="relative w-full h-full">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={{ lat: playerGeo.lat, lng: playerGeo.lng }}
          defaultZoom={mode === 'mini' ? 15 : 14}
          mapTypeId={mapType}
          gestureHandling={mode === 'mini' ? 'none' : 'greedy'}
          disableDefaultUI={true}
          onClick={(e) => {
            if (mode === 'full' && e.detail.latLng && onSetWaypoint) {
              const { lat, lng } = e.detail.latLng;
              const worldPos = latLngToWorld(lat, lng);
              onSetWaypoint(
                worldPos.x,
                worldPos.z,
                `Satellite Pin (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`,
              );
            }
          }}
        >
          <MapCameraFollower
            lat={playerGeo.lat}
            lng={playerGeo.lng}
            follow={mode === 'mini'}
          />

          {/* Player Real-Time Synchronized GPS Marker */}
          <AdvancedMarker
            position={playerGeo}
            title={`သင် (Player) — ${playerGeo.lat}°N, ${playerGeo.lng}°E`}
            zIndex={100}
          >
            <div className="px-1.5 py-0.5 rounded-full bg-emerald-500 border-2 border-white text-[9px] font-extrabold text-slate-950 shadow-lg whitespace-nowrap">
              ▲ သင် (You)
            </div>
          </AdvancedMarker>

          {/* Active GPS Waypoint Marker */}
          <AdvancedMarker
            position={waypointGeo}
            title={`GPS လမ်းညွှန်: ${hud.waypointLabelMm}`}
            zIndex={90}
          >
            <Pin background="#10b981" borderColor="#ffffff" glyphColor="#052e16" scale={0.95} />
          </AdvancedMarker>

          {/* Major Myitkyina Landmarks */}
          {mode === 'full' &&
            MYITKYINA_LANDMARKS.map((lm) => (
              <AdvancedMarker
                key={lm.id}
                position={{ lat: lm.lat, lng: lm.lng }}
                title={`${lm.nameMm} (${lm.nameEn})`}
                onClick={() => onSetWaypoint?.(lm.x, lm.z, lm.nameMm)}
              >
                <div className="px-1.5 py-0.5 rounded bg-slate-950/90 border border-amber-400 text-[9px] font-bold text-amber-300 shadow whitespace-nowrap">
                  ★ {lm.nameMm}
                </div>
              </AdvancedMarker>
            ))}

          {/* Famous Real-World Myitkyina Shops, Hotels & University */}
          {MYITKYINA_FAMOUS_BUILDINGS.map((b) => {
            const isSelected = selectedBuilding?.id === b.id;
            return (
              <AdvancedMarker
                key={b.id}
                position={{ lat: b.lat, lng: b.lng }}
                title={`${b.nameMm} — ${b.nameEn}`}
                onClick={() => {
                  onSelectBuilding?.(b);
                  if (mode === 'mini') {
                    onSetWaypoint?.(b.x, b.z, b.nameMm);
                  }
                }}
                zIndex={isSelected ? 85 : 50}
              >
                {mode === 'mini' ? (
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-white shadow"
                    style={{ backgroundColor: b.accentColor }}
                  />
                ) : (
                  <div
                    className={`px-1.5 py-0.5 rounded border text-[9px] font-bold shadow cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-500 border-white text-slate-950 scale-110'
                        : 'bg-slate-900/90 border-emerald-400/70 text-white'
                    }`}
                  >
                    {b.nameMm}
                  </div>
                )}
              </AdvancedMarker>
            );
          })}
        </GoogleMap>

        {/* Map Type Switcher on Full Map (Hybrid Satellite / Pure Satellite / Street Map) */}
        {mode === 'full' && (
          <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1 bg-slate-950/90 border border-white/20 rounded-lg p-1 shadow-lg">
            {(
              [
                ['hybrid', 'ဂြိုဟ်တု + လမ်းအမည် (Hybrid)'],
                ['satellite', 'ဂြိုဟ်တုသီးသန့် (Satellite)'],
                ['roadmap', 'လမ်းမြေပုံ (Streets)'],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setMapType(t)}
                className={`px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                  mapType === t
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </APIProvider>
  );
};
