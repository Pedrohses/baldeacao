'use client';

import type { NearbyStop } from '@baldeacao/types';
import { useEffect, useMemo, useRef } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { MAP_COLORS } from '@/shared/ui/map';

import { useNearbyStops, type NearbyStopsCenter } from '../hooks';
import { stopsToGeoJson } from '../utils/stops-geojson';

export const STOPS_SOURCE_ID = 'stops';
export const STOPS_LAYER_ID = 'stops-circles';
export const STOPS_SELECTED_LAYER_ID = 'stops-selected';
/** Paradas só aparecem de perto: abaixo disso seriam ruído sobre os ônibus. */
export const STOPS_MIN_ZOOM = 14;

export interface StopsLayerProps {
  /** Centro da busca (normalmente o centro do mapa ou a posição do usuário). */
  center: NearbyStopsCenter | null;
  /** Raio em metros; padrão e máximo definidos pelo contrato da API. */
  radius?: number;
  /** Parada em destaque (controlada por quem compõe a tela). */
  selectedStopId?: string | null;
  /** Chamado quando o usuário toca numa parada do mapa. */
  onSelectStop: (stop: NearbyStop) => void;
}

/** Paradas próximas como camada GeoJSON; deve ser filha do mapa. */
export function StopsLayer({
  center,
  radius,
  selectedStopId = null,
  onSelectStop,
}: StopsLayerProps) {
  const { data: stops } = useNearbyStops(center, radius);
  const { current: map } = useMap();

  const geojson = useMemo(() => stopsToGeoJson(stops ?? []), [stops]);

  // Refs evitam reassinar o evento a cada nova lista ou callback.
  const stopsRef = useRef<readonly NearbyStop[]>([]);
  const onSelectRef = useRef(onSelectStop);
  useEffect(() => {
    stopsRef.current = stops ?? [];
    onSelectRef.current = onSelectStop;
  });

  useEffect(() => {
    if (!map) return;
    const handleClick = (event: { features?: { properties?: Record<string, unknown> }[] }) => {
      const id = event.features?.[0]?.properties?.id;
      const stop = stopsRef.current.find((s) => s.id === id);
      if (stop) onSelectRef.current(stop);
    };
    const pointer = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const reset = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', STOPS_LAYER_ID, handleClick);
    map.on('mouseenter', STOPS_LAYER_ID, pointer);
    map.on('mouseleave', STOPS_LAYER_ID, reset);
    return () => {
      map.off('click', STOPS_LAYER_ID, handleClick);
      map.off('mouseenter', STOPS_LAYER_ID, pointer);
      map.off('mouseleave', STOPS_LAYER_ID, reset);
    };
  }, [map]);

  return (
    <Source id={STOPS_SOURCE_ID} type="geojson" data={geojson}>
      {/* Parada é oca (miolo branco, anel escuro) para não se confundir com o ônibus cheio. */}
      <Layer
        id={STOPS_LAYER_ID}
        type="circle"
        minzoom={STOPS_MIN_ZOOM}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], STOPS_MIN_ZOOM, 4, 17, 7],
          'circle-color': MAP_COLORS.surface,
          'circle-stroke-color': MAP_COLORS.text,
          'circle-stroke-width': 2,
        }}
      />
      <Layer
        id={STOPS_SELECTED_LAYER_ID}
        type="circle"
        filter={['==', ['get', 'id'], selectedStopId ?? '']}
        paint={{
          'circle-radius': 9,
          'circle-color': MAP_COLORS.brand,
          'circle-stroke-color': MAP_COLORS.surface,
          'circle-stroke-width': 3,
        }}
      />
    </Source>
  );
}
