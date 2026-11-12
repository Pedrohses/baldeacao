'use client';

import type { TripRequest } from '@baldeacao/types';
import { useQuery } from '@tanstack/react-query';

import { tripKeys, tripPlannerService } from '../services';

/** Itinerários para o pedido; sem pedido a consulta fica desligada. */
export function useTripPlan(request: TripRequest | null) {
  return useQuery({
    queryKey: request ? tripKeys.plan(request) : tripKeys.all,
    queryFn: ({ signal }) => tripPlannerService.plan(request!, { signal }),
    enabled: request !== null,
    staleTime: 60 * 1000, // horários com tempo real envelhecem rápido
    retry: false,
  });
}
