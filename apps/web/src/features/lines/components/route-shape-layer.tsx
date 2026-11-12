'use client';

import type { LngLatBoundsLike } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { useLineDetails } from '../hooks';
import { shapesToGeoJson } from '../utils/shapes-geojson';

export const ROUTE_SHAPE_SOURCE_ID = 'route-shape';
export const ROUTE_SHAPE_OUTBOUND_LAYER_ID = 'route-shape-0';
export const ROUTE_SHAPE_INBOUND_LAYER_ID = 'route-shape-1';

const FALLBACK_COLOR = '#C7361F';

export interface RouteShapeLayerProps {
  /** route_id da linha cujo traçado será desenhado; null não desenha nada. */
  routeId: string | null;
  /** Com folga, enquadra o traçado quando ele chega (o painel cobre parte do mapa). */
  fitPadding?: number | { top: number; bottom: number; left: number; right: number };
}

function shapeBounds(points: readonly { lat: number; lon: number }[]): LngLatBoundsLike | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const { lat, lon } of points) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

/** Traçado da linha, um por sentido (ida contínua, volta tracejada); deve ser filha do mapa. */
export function RouteShapeLayer({ routeId, fitPadding }: RouteShapeLayerProps) {
  const { current: map } = useMap();
  const { data } = useLineDetails(routeId);
  const geojson = useMemo(() => shapesToGeoJson(data?.shapes ?? []), [data]);

  useEffect(() => {
    if (!map || !data || fitPadding === undefined) return;
    const bounds = shapeBounds(data.shapes.flatMap((shape) => shape.points));
    if (bounds) map.fitBounds(bounds, { padding: fitPadding, maxZoom: 15, duration: 600 });
  }, [map, data, fitPadding]);

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
        paint={{
          'line-color': color,
          'line-width': 4,
          'line-dasharray': [2, 2],
          'line-opacity': 0.8,
        }}
      />
    </Source>
  );
}
