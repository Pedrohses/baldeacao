import {
  API_PATHS,
  NEARBY_STOPS_DEFAULT_RADIUS_M,
  NearbyStopsResponseSchema,
  StopArrivalsResponseSchema,
  type NearbyStopsResponse,
  type StopArrivalsResponse,
} from '@baldeacao/types';

import { apiGet } from '@/shared/lib/api-client';

export interface NearbyStopsParams {
  lat: number;
  lon: number;
  radius?: number;
}

export const stopsService = {
  getNearby(
    { lat, lon, radius = NEARBY_STOPS_DEFAULT_RADIUS_M }: NearbyStopsParams,
    init?: RequestInit,
  ): Promise<NearbyStopsResponse> {
    const query = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      radius: String(radius),
    });
    return apiGet(`${API_PATHS.nearbyStops}?${query}`, NearbyStopsResponseSchema, init);
  },

  getArrivals(stopId: string, init?: RequestInit): Promise<StopArrivalsResponse> {
    return apiGet(API_PATHS.stopArrivals(stopId), StopArrivalsResponseSchema, init);
  },
};
