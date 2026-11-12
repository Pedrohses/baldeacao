import { API_PATHS, SearchPlacesResponseSchema, type Place } from '@baldeacao/types';

import { apiGet } from '@/shared/lib/api-client';

export const placesService = {
  /** Busca lugares por texto (Nominatim no backend). O texto chega aparado e com 3+ caracteres. */
  async search(query: string, init?: RequestInit): Promise<Place[]> {
    const params = new URLSearchParams({ q: query });
    const { places } = await apiGet(
      `${API_PATHS.searchPlaces}?${params.toString()}`,
      SearchPlacesResponseSchema,
      init,
    );
    return places;
  },
};
