'use client';

import { NEARBY_STOPS_DEFAULT_RADIUS_M } from '@baldeacao/types';
import { useQuery } from '@tanstack/react-query';

import { stopKeys, stopsService } from '../services';

export interface NearbyStopsCenter {
  lat: number;
  lon: number;
}

/** Paradas num raio do centro. Sem centro (null) a consulta fica desligada. */
export function useNearbyStops(
  center: NearbyStopsCenter | null,
  radius: number = NEARBY_STOPS_DEFAULT_RADIUS_M,
) {
  return useQuery({
    queryKey: center ? stopKeys.nearby(center.lat, center.lon, radius) : stopKeys.all,
    queryFn: ({ signal }) =>
      stopsService.getNearby({ lat: center!.lat, lon: center!.lon, radius }, { signal }),
    enabled: center !== null,
    select: (data) => data.stops,
  });
}
