import { toLonLat, type NearbyStop } from '@baldeacao/types';

export interface StopFeatureProperties {
  id: string;
  name: string;
}

export interface StopsFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: StopFeatureProperties;
    geometry: { type: 'Point'; coordinates: [number, number] };
  }[];
}

export function stopsToGeoJson(stops: readonly NearbyStop[]): StopsFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stops.map((stop) => ({
      type: 'Feature',
      properties: { id: stop.id, name: stop.name },
      geometry: { type: 'Point', coordinates: toLonLat(stop.location) },
    })),
  };
}
