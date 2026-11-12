import type { SearchPlacesMode } from '@baldeacao/types';

export const placeKeys = {
  all: ['places'] as const,
  search: (query: string, mode: SearchPlacesMode) =>
    [...placeKeys.all, 'search', mode, query] as const,
};
