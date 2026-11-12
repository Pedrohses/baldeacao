'use client';

import type { Itinerary } from '@baldeacao/types';
import type { ExpressionSpecification } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { itineraryBounds, itineraryToGeoJson } from '../utils/itinerary-geojson';

export const ITINERARY_SOURCE_ID = 'itinerary';
export const ITINERARY_TRANSIT_CASING_LAYER_ID = 'itinerary-transit-casing';
export const ITINERARY_TRANSIT_LAYER_ID = 'itinerary-transit';
export const ITINERARY_WALK_LAYER_ID = 'itinerary-walk';

/** Opacidade dos trechos fora de foco quando um trecho é tocado na linha do tempo. */
export const UNFOCUSED_LEG_OPACITY = 0.35;

export type FitPadding = number | { top: number; bottom: number; left: number; right: number };

export interface ItineraryLayerProps {
  /** Itinerário selecionado; null não desenha nada. */
  itinerary: Itinerary | null;
  /** Trecho em destaque (índice em `legs`); null deixa todos iguais. */
  focusedLeg?: number | null;
  /** Folga do enquadramento: o painel cobre parte do mapa. */
  fitPadding?: FitPadding;
}

function legOpacity(focusedLeg: number | null): number | ExpressionSpecification {
  if (focusedLeg === null) return 1;
  return ['case', ['==', ['get', 'legIndex'], focusedLeg], 1, UNFOCUSED_LEG_OPACITY];
}

/**
 * Trechos do itinerário no mapa: transporte na cor da linha (com contorno branco para destacar
 * do mapa) e caminhada tracejada. Enquadra o itinerário ao trocar a seleção. Filha do mapa.
 */
export function ItineraryLayer({ itinerary, focusedLeg = null, fitPadding = 64 }: ItineraryLayerProps) {
  const { current: map } = useMap();
  const geojson = useMemo(() => itineraryToGeoJson(itinerary), [itinerary]);

  useEffect(() => {
    if (!map || !itinerary) return;
    const leg = focusedLeg === null ? null : itinerary.legs[focusedLeg];
    const bounds = itineraryBounds(itinerary, leg ? [leg] : undefined);
    if (bounds) map.fitBounds(bounds, { padding: fitPadding, maxZoom: 16, duration: 600 });
  }, [map, itinerary, focusedLeg, fitPadding]);

  if (!itinerary) return null;
  const opacity = legOpacity(focusedLeg);

  return (
    <Source id={ITINERARY_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={ITINERARY_TRANSIT_CASING_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': opacity }}
      />
      <Layer
        id={ITINERARY_TRANSIT_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': opacity }}
      />
      <Layer
        id={ITINERARY_WALK_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], true]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-dasharray': [0.5, 2],
          'line-opacity': opacity,
        }}
      />
    </Source>
  );
}
