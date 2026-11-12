import {
  API_PATHS,
  ReversePlaceResponseSchema,
  SearchPlacesResponseSchema,
  type Coordinates,
  type Place,
  type SearchPlacesMode,
} from '@baldeacao/types';

import { apiGet } from '@/shared/lib/api-client';

export const placesService = {
  /**
   * Busca lugares por texto. `quick` (autocompletar) consulta só paradas e estações locais;
   * `full` (busca confirmada) inclui endereços do Nominatim. O texto chega aparado.
   */
  async search(query: string, mode: SearchPlacesMode, init?: RequestInit): Promise<Place[]> {
    const params = new URLSearchParams({ q: query, mode });
    const { places } = await apiGet(
      `${API_PATHS.searchPlaces}?${params.toString()}`,
      SearchPlacesResponseSchema,
      init,
    );
    return places;
  },

  /** Lugar mais próximo de um ponto (busca reversa); null quando não há nada por perto. */
  async reverse(location: Coordinates, init?: RequestInit): Promise<Place | null> {
    const params = new URLSearchParams({ lat: String(location.lat), lon: String(location.lon) });
    const { place } = await apiGet(
      `${API_PATHS.reversePlace}?${params.toString()}`,
      ReversePlaceResponseSchema,
      init,
    );
    return place;
  },
};
