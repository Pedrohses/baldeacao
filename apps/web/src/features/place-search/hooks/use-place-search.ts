'use client';

import { SearchPlacesQuerySchema, type Place } from '@baldeacao/types';
import { useQuery } from '@tanstack/react-query';

import { placeKeys, placesService } from '../services';
import { useDebouncedValue } from './use-debounced-value';

export const PLACE_SEARCH_DEBOUNCE_MS = 300;
export const PLACE_SEARCH_MIN_LENGTH = 2;

export type PlaceSearchStatus = 'idle' | 'too-short' | 'loading' | 'error' | 'empty' | 'success';

export interface PlaceSearchResult {
  status: PlaceSearchStatus;
  places: Place[];
  /** Texto (aparado) a que `places` corresponde. */
  query: string;
  retry: () => void;
}

/**
 * Autocompletar (`mode=quick`, só paradas e estações locais): espera PLACE_SEARCH_DEBOUNCE_MS sem
 * digitação e só consulta com PLACE_SEARCH_MIN_LENGTH caracteres ou mais. `enabled: false` desliga
 * a busca (ex.: o texto é o nome de um lugar já escolhido).
 */
export function usePlaceSearch(text: string, enabled = true): PlaceSearchResult {
  const trimmed = text.trim();
  const debounced = useDebouncedValue(trimmed, PLACE_SEARCH_DEBOUNCE_MS);
  const isValid = SearchPlacesQuerySchema.safeParse({ q: debounced, mode: 'quick' }).success;

  const query = useQuery({
    queryKey: placeKeys.search(debounced, 'quick'),
    queryFn: ({ signal }) => placesService.search(debounced, 'quick', { signal }),
    enabled: enabled && isValid,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const base = { query: trimmed, retry: () => void query.refetch() };
  if (!enabled || trimmed.length === 0) return { ...base, status: 'idle', places: [] };
  if (trimmed.length < PLACE_SEARCH_MIN_LENGTH) return { ...base, status: 'too-short', places: [] };
  // Dentro da janela de debounce o texto digitado ainda não é o consultado.
  if (debounced !== trimmed || query.isPending) return { ...base, status: 'loading', places: [] };
  if (query.isError) return { ...base, status: 'error', places: [] };
  if (query.data.length === 0) return { ...base, status: 'empty', places: [] };
  return { ...base, status: 'success', places: query.data };
}
