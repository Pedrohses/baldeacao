'use client';

import { useQueries } from '@tanstack/react-query';

import { stopKeys, stopsService } from '../services';
import { type NearbyLine, nearbyLinesFrom } from '../utils/nearby-lines';
import { ARRIVALS_REFETCH_MS } from './use-stop-arrivals';
import { type NearbyStopsCenter, useNearbyStops } from './use-nearby-stops';

/** Paradas consultadas para montar as linhas perto. */
const STOPS_FOR_LINES = 4;

export interface NearbyLinesResult {
  lines: NearbyLine[];
  isPending: boolean;
  isError: boolean;
}

/**
 * Linhas que passam nas paradas mais próximas, com a próxima chegada de cada. Reaproveita o cache
 * das previsões por parada (mesma chave da lista de paradas).
 */
export function useNearbyLines(center: NearbyStopsCenter | null, limit: number): NearbyLinesResult {
  const stops = useNearbyStops(center);
  const nearest = [...(stops.data ?? [])]
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, STOPS_FOR_LINES);
  const arrivals = useQueries({
    queries: nearest.map((stop) => ({
      queryKey: stopKeys.arrivals(stop.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        stopsService.getArrivals(stop.id, { signal }),
      refetchInterval: ARRIVALS_REFETCH_MS,
    })),
  });

  const loaded = arrivals.flatMap((query) => query.data?.arrivals ?? []);
  return {
    lines: nearbyLinesFrom(loaded, limit),
    isPending: stops.isPending || (nearest.length > 0 && arrivals.every((q) => q.isPending)),
    isError: stops.isError || (arrivals.length > 0 && arrivals.every((q) => q.isError)),
  };
}
