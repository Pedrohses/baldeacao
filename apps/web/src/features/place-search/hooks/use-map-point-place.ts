'use client';

import type { Coordinates, Place } from '@baldeacao/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { coordinatesPlace } from '@/shared/utils/place';

import { placeKeys, placesService } from '../services';

const REVERSE_STALE_MS = 60 * 60 * 1000; // o nome de um ponto quase nunca muda

/**
 * Lugar para um ponto escolhido no mapa: fica na coordenada tocada (a rota sai dali), mas ganha o
 * nome e o endereço do lugar mais próximo. Sem resultado, continua "Ponto no mapa".
 */
export function mapPointPlace(location: Coordinates, nearest: Place | null | undefined): Place {
  if (!nearest) return coordinatesPlace(location);
  return { ...coordinatesPlace(location, nearest.name), address: nearest.address };
}

function reverseQuery(location: Coordinates) {
  return {
    queryKey: placeKeys.reverse(location),
    queryFn: ({ signal }: { signal: AbortSignal }) => placesService.reverse(location, { signal }),
    staleTime: REVERSE_STALE_MS,
    retry: false,
  } as const;
}

/** Nome do ponto (alfinete do toque longo). Enquanto busca, ou se falhar, vale "Ponto no mapa". */
export function useMapPointPlace(location: Coordinates | null): {
  place: Place | null;
  isResolving: boolean;
} {
  const query = useQuery({
    ...reverseQuery(location ?? { lat: 0, lon: 0 }),
    enabled: location !== null,
  });
  if (!location) return { place: null, isResolving: false };
  return { place: mapPointPlace(location, query.data), isResolving: query.isPending };
}

/** Versão sob demanda (confirmar a mira): nunca rejeita, cai em "Ponto no mapa". */
export function useResolveMapPoint(): (location: Coordinates) => Promise<Place> {
  const queryClient = useQueryClient();
  return useCallback(
    async (location: Coordinates) => {
      try {
        const nearest = await queryClient.fetchQuery(reverseQuery(location));
        return mapPointPlace(location, nearest);
      } catch {
        return mapPointPlace(location, null);
      }
    },
    [queryClient],
  );
}
