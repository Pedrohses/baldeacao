'use client';

import { useQuery } from '@tanstack/react-query';

import { stopKeys, stopsService } from '../services';

export const ARRIVALS_REFETCH_MS = 15_000;

/** Previsões da parada, atualizadas a cada 15 s. Sem stopId a consulta fica desligada. */
export function useStopArrivals(stopId: string | null) {
  return useQuery({
    queryKey: stopId ? stopKeys.arrivals(stopId) : stopKeys.all,
    queryFn: ({ signal }) => stopsService.getArrivals(stopId!, { signal }),
    enabled: stopId !== null,
    refetchInterval: ARRIVALS_REFETCH_MS,
    select: (data) => data.arrivals,
  });
}
