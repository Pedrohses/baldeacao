'use client';

import { useState } from 'react';
import type { NearbyStop } from '@baldeacao/types';
import {
  DEFAULT_MAP_VIEWPORT,
  MapViewportSync,
  StaleDataNotice,
  VehiclesLayer,
  useMapStore,
} from '@/features/live-map';
import { StopSheet, StopsLayer } from '@/features/stops';
import { BaseMap } from '@/shared/ui/map';

// Abaixo desse zoom o raio de 2 km cobre pouco da tela e a consulta não compensa.
const STOPS_MIN_ZOOM = 14;

/** Composição das camadas da tela do mapa (ordem: paradas embaixo, veículos por cima). */
export function MapScreen() {
  const viewport = useMapStore((state) => state.viewport);
  const selectStop = useMapStore((state) => state.selectStop);
  const clearSelection = useMapStore((state) => state.clearSelection);
  const [selectedStop, setSelectedStop] = useState<NearbyStop | null>(null);

  const stopsCenter =
    viewport.zoom >= STOPS_MIN_ZOOM ? { lat: viewport.latitude, lon: viewport.longitude } : null;

  function handleSelectStop(stop: NearbyStop) {
    setSelectedStop(stop);
    selectStop(stop.id);
  }

  function handleCloseStop() {
    setSelectedStop(null);
    clearSelection();
  }

  return (
    <main className="relative h-dvh w-full">
      <h1 className="sr-only">Baldeação - mapa de São Paulo</h1>
      <BaseMap initialViewState={DEFAULT_MAP_VIEWPORT}>
        <MapViewportSync />
        <StopsLayer
          center={stopsCenter}
          selectedStopId={selectedStop?.id}
          onSelectStop={handleSelectStop}
        />
        <VehiclesLayer />
      </BaseMap>
      <StaleDataNotice />
      {selectedStop ? <StopSheet stop={selectedStop} onClose={handleCloseStop} /> : null}
    </main>
  );
}
