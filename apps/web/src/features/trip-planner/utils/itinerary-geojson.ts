import { toLonLat, type Itinerary, type TripMode } from '@baldeacao/types';

import { legColor } from './format';

export interface LegFeatureProperties {
  legIndex: number;
  mode: TripMode;
  isWalk: boolean;
  color: string;
}

export type PointKind = 'origin' | 'destination' | 'stop';

export interface PointFeatureProperties {
  kind: PointKind;
  /** Trecho a que o ponto pertence (embarque e desembarque), ou o primeiro/último na origem/destino. */
  legIndex: number;
  /** Cor da linha do trecho (ônibus, trilho). */
  color: string;
  /** Embarque ou desembarque de uma baldeação (há outro trecho de transporte antes ou depois). */
  transfer: boolean;
}

export interface ItineraryFeatureCollection {
  type: 'FeatureCollection';
  features: (
    | {
        type: 'Feature';
        properties: LegFeatureProperties;
        geometry: { type: 'LineString'; coordinates: [number, number][] };
      }
    | {
        type: 'Feature';
        properties: PointFeatureProperties;
        geometry: { type: 'Point'; coordinates: [number, number] };
      }
  )[];
}

function pointFeatures(itinerary: Itinerary): ItineraryFeatureCollection['features'] {
  const { legs } = itinerary;
  const first = legs[0];
  const last = legs[legs.length - 1];
  if (!first || !last) return [];
  const features: ItineraryFeatureCollection['features'] = [];
  const point = (
    kind: PointKind,
    legIndex: number,
    place: { lat: number; lon: number },
    color: string,
    transfer: boolean,
  ) =>
    features.push({
      type: 'Feature',
      properties: { kind, legIndex, color, transfer },
      geometry: { type: 'Point', coordinates: toLonLat(place) },
    });
  legs.forEach((leg, index) => {
    if (leg.mode === 'walk') return;
    const before = legs.slice(0, index).some((other) => other.mode !== 'walk');
    const after = legs.slice(index + 1).some((other) => other.mode !== 'walk');
    point('stop', index, leg.from.location, legColor(leg), before);
    point('stop', index, leg.to.location, legColor(leg), after);
  });
  point('origin', 0, first.from.location, '#000000', false);
  point('destination', legs.length - 1, last.to.location, '#000000', false);
  return features;
}

/**
 * Uma LineString por trecho, com coordenadas [lon, lat] e a cor já resolvida, mais os pontos:
 * origem, destino e embarque/desembarque de cada trecho de transporte.
 */
export function itineraryToGeoJson(itinerary: Itinerary | null): ItineraryFeatureCollection {
  const lines: ItineraryFeatureCollection['features'] = (itinerary?.legs ?? []).map(
    (leg, legIndex) => ({
      type: 'Feature',
      properties: { legIndex, mode: leg.mode, isWalk: leg.mode === 'walk', color: legColor(leg) },
      geometry: { type: 'LineString', coordinates: leg.points.map(toLonLat) },
    }),
  );
  return {
    type: 'FeatureCollection',
    features: [...lines, ...(itinerary ? pointFeatures(itinerary) : [])],
  };
}

/** Caixa [[oeste, sul], [leste, norte]] dos pontos do itinerário (ou só dos trechos dados). */
export function itineraryBounds(
  itinerary: Itinerary,
  legs: readonly Itinerary['legs'][number][] = itinerary.legs,
): [[number, number], [number, number]] | null {
  const points = legs.flatMap((leg) => leg.points);
  if (points.length === 0) return null;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}
