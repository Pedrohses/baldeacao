'use client';

import {
  POSITIONS_ALL_CHANNEL,
  type PositionsUpdate,
  type VehicleSnapshot,
  positionsLineChannel,
} from '@baldeacao/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { subscribePositions } from '@/shared/lib/realtime-client';

import { vehicleKeys } from '../services/query-keys';
import { vehiclePositionsService } from '../services/vehicle-positions.service';

/** Converte o payload do socket no snapshot do cache, ignorando ciclos mais antigos que o atual. */
export function applyPositionsUpdate(
  current: VehicleSnapshot | undefined,
  update: PositionsUpdate,
): VehicleSnapshot {
  const { sourceId, routeId, updatedAt, vehicles } = update;
  if (current && Date.parse(current.updatedAt) > Date.parse(updatedAt)) return current;
  return { sourceId, routeId, updatedAt, vehicles };
}

/**
 * Posições dos veículos: busca o snapshot pela API e mantém o cache atualizado
 * com cada `positions:update` do canal (de uma linha ou de todas).
 */
export function useVehiclePositions(routeId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: vehicleKeys.positions(routeId),
    queryFn: ({ signal }) => vehiclePositionsService.getSnapshot(routeId, signal),
    // O socket mantém o dado fresco; a busca só se repete se o cache for descartado.
    staleTime: Infinity,
  });

  useEffect(() => {
    const channel = routeId ? positionsLineChannel(routeId) : POSITIONS_ALL_CHANNEL;
    const key = vehicleKeys.positions(routeId);
    return subscribePositions(channel, (update) => {
      queryClient.setQueryData<VehicleSnapshot>(key, (current) =>
        applyPositionsUpdate(current, update),
      );
    });
  }, [queryClient, routeId]);

  return query;
}
