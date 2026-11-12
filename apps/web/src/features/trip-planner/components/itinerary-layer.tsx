'use client';

import type { Itinerary } from '@baldeacao/types';
import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { itineraryBounds, itineraryToGeoJson } from '../utils/itinerary-geojson';

export const ITINERARY_SOURCE_ID = 'itinerary';
export const ITINERARY_TRANSIT_CASING_LAYER_ID = 'itinerary-transit-casing';
export const ITINERARY_TRANSIT_LAYER_ID = 'itinerary-transit';
export const ITINERARY_WALK_LAYER_ID = 'itinerary-walk';

export interface ItineraryLayerProps {
  /** Itinerário selecionado; null não desenha nada. */
  itinerary: Itinerary | null;
}

/**
 * Trechos do itinerário no mapa: transporte na cor da linha (com contorno branco para destacar
 * do mapa) e caminhada tracejada. Enquadra o itinerário ao trocar a seleção. Filha do mapa.
 */
export function ItineraryLayer({ itinerary }: ItineraryLayerProps) {
  const { current: map } = useMap();
  const geojson = useMemo(() => itineraryToGeoJson(itinerary), [itinerary]);

  useEffect(() => {
    if (!map || !itinerary) return;
    const bounds = itineraryBounds(itinerary);
    if (bounds) map.fitBounds(bounds, { padding: 64, maxZoom: 16, duration: 600 });
  }, [map, itinerary]);

  if (!itinerary) return null;

  return (
    <Source id={ITINERARY_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={ITINERARY_TRANSIT_CASING_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#FFFFFF', 'line-width': 9 }}
      />
      <Layer
        id={ITINERARY_TRANSIT_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 6 }}
      />
      <Layer
        id={ITINERARY_WALK_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], true]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [0.5, 2] }}
      />
    </Source>
  );
}
