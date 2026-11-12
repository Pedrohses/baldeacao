import { API_PATHS, LineDetailsResponseSchema, type LineDetailsResponse } from '@baldeacao/types';

import { apiGet } from '@/shared/lib/api-client';

export const linesService = {
  getDetails(routeId: string, init?: RequestInit): Promise<LineDetailsResponse> {
    return apiGet(API_PATHS.lineDetails(routeId), LineDetailsResponseSchema, init);
  },
};
