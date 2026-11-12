'use client';

import { useMemo } from 'react';
import { Layer, Source } from 'react-map-gl/maplibre';

import { useLineDetails } from '../hooks';
import { shapesToGeoJson } from '../utils/shapes-geojson';

export const ROUTE_SHAPE_SOURCE_ID = 'route-shape';
export const ROUTE_SHAPE_OUTBOUND_LAYER_ID = 'route-shape-0';
export const ROUTE_SHAPE_INBOUND_LAYER_ID = 'route-shape-1';

const FALLBACK_COLOR = '#1d4ed8';

export interface RouteShapeLayerProps {
  /** route_id da linha cujo traçado será desenhado; null não desenha nada. */
  routeId: string | null;
}

/** Traçado da linha, um por sentido (ida contínua, volta tracejada); deve ser filha do mapa. */
export function RouteShapeLayer({ routeId }: RouteShapeLayerProps) {
  const { data } = useLineDetails(routeId);
  const geojson = useMemo(() => shapesToGeoJson(data?.shapes ?? []), [data]);

  if (!data) return null;
  const color = data.line.color ? `#${data.line.color}` : FALLBACK_COLOR;

  return (
    <Source id={ROUTE_SHAPE_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={ROUTE_SHAPE_OUTBOUND_LAYER_ID}
        type="line"
        filter={['==', ['get', 'directionId'], 0]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': color, 'line-width': 5 }}
      />
      <Layer
        id={ROUTE_SHAPE_INBOUND_LAYER_ID}
        type="line"
        filter={['==', ['get', 'directionId'], 1]}
        layout={{ 'line-join': 'round' }}
        paint={{ 'line-color': color, 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': 0.8 }}
      />
    </Source>
  );
}
