'use client';

import { useQuery } from '@tanstack/react-query';

import { lineKeys, linesService } from '../services';

/** Linha e traçados por sentido. Sem routeId a consulta fica desligada. */
export function useLineDetails(routeId: string | null) {
  return useQuery({
    queryKey: routeId ? lineKeys.details(routeId) : lineKeys.all,
    queryFn: ({ signal }) => linesService.getDetails(routeId!, { signal }),
    enabled: routeId !== null,
    staleTime: 60 * 60 * 1000, // o traçado planejado muda raramente
  });
}
