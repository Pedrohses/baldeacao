import type { Coordinates, SearchPlacesMode } from '@baldeacao/types';

export const placeKeys = {
  all: ['places'] as const,
  search: (query: string, mode: SearchPlacesMode) =>
    [...placeKeys.all, 'search', mode, query] as const,
  // ~1 m: toques no mesmo ponto reaproveitam o cache.
  reverse: ({ lat, lon }: Coordinates) =>
    [...placeKeys.all, 'reverse', lat.toFixed(5), lon.toFixed(5)] as const,
};
