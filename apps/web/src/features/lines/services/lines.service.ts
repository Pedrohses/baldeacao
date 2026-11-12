import {
  API_PATHS,
  LineDetailsResponseSchema,
  SearchLinesResponseSchema,
  type LineDetailsResponse,
  type Route,
} from '@baldeacao/types';

import { apiGet } from '@/shared/lib/api-client';

export const linesService = {
  getDetails(routeId: string, init?: RequestInit): Promise<LineDetailsResponse> {
    return apiGet(API_PATHS.lineDetails(routeId), LineDetailsResponseSchema, init);
  },

  /** Linhas por código ou nome (o texto chega aparado, com 2 caracteres ou mais). */
  async search(query: string, init?: RequestInit): Promise<Route[]> {
    const params = new URLSearchParams({ q: query });
    const { lines } = await apiGet(
      `${API_PATHS.searchLines}?${params.toString()}`,
      SearchLinesResponseSchema,
      init,
    );
    return lines;
  },
};
