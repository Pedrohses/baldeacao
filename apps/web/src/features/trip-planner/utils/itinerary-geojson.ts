import { toLonLat, type Itinerary, type TripMode } from '@baldeacao/types';

import { legColor } from './format';

export interface LegFeatureProperties {
  legIndex: number;
  mode: TripMode;
  isWalk: boolean;
  color: string;
}

export interface ItineraryFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: LegFeatureProperties;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }[];
}

/** Uma LineString por trecho, com coordenadas [lon, lat] e a cor já resolvida. */
export function itineraryToGeoJson(itinerary: Itinerary | null): ItineraryFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (itinerary?.legs ?? []).map((leg, legIndex) => ({
      type: 'Feature',
      properties: { legIndex, mode: leg.mode, isWalk: leg.mode === 'walk', color: legColor(leg) },
      geometry: { type: 'LineString', coordinates: leg.points.map(toLonLat) },
    })),
  };
}

/** Caixa [[oeste, sul], [leste, norte]] de todos os pontos do itinerário. */
export function itineraryBounds(itinerary: Itinerary): [[number, number], [number, number]] | null {
  const points = itinerary.legs.flatMap((leg) => leg.points);
  if (points.length === 0) return null;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
