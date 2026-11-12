import type { Coordinates, Place } from '@baldeacao/types';

export const CURRENT_LOCATION_NAME = 'Minha localização';
export const MAP_POINT_NAME = 'Ponto no mapa';

/** Lugar a partir de uma coordenada (GPS ou ponto escolhido no mapa). */
export function coordinatesPlace(location: Coordinates, name: string = MAP_POINT_NAME): Place {
  return {
    id: `coords:${location.lat.toFixed(6)},${location.lon.toFixed(6)}`,
    name,
    address: null,
    kind: 'coordinates',
    location,
  };
}

export function currentLocationPlace(location: Coordinates): Place {
  return { ...coordinatesPlace(location, CURRENT_LOCATION_NAME), id: 'current-location' };
}
