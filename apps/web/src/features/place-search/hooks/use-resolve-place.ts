'use client';

import type { Place } from '@baldeacao/types';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { placeKeys, placesService } from '../services';

/** Busca confirmada (`mode=full`, com endereços do Nominatim), com o mesmo cache do React Query. */
export function useResolvePlace(): (text: string) => Promise<Place[]> {
  const queryClient = useQueryClient();
  return useCallback(
    (text: string) => {
      const q = text.trim();
      return queryClient.fetchQuery({
        queryKey: placeKeys.search(q, 'full'),
        queryFn: ({ signal }) => placesService.search(q, 'full', { signal }),
        staleTime: 10 * 60 * 1000,
        retry: false,
      });
    },
    [queryClient],
  );
}
