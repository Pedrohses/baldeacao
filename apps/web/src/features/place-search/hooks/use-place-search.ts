'use client';

import { SearchPlacesQuerySchema, type Place } from '@baldeacao/types';
import { useQuery } from '@tanstack/react-query';

import { placeKeys, placesService } from '../services';
import { useDebouncedValue } from './use-debounced-value';

export const PLACE_SEARCH_DEBOUNCE_MS = 300;
export const PLACE_SEARCH_MIN_LENGTH = 3;

export type PlaceSearchStatus = 'idle' | 'too-short' | 'loading' | 'error' | 'empty' | 'success';

export interface PlaceSearchResult {
  status: PlaceSearchStatus;
  places: Place[];
}

/**
 * Busca lugares conforme o usuário digita: espera PLACE_SEARCH_DEBOUNCE_MS sem digitação e só
 * consulta com PLACE_SEARCH_MIN_LENGTH caracteres ou mais. `enabled: false` desliga a busca
 * (ex.: o texto é o nome de um lugar já escolhido).
 */
export function usePlaceSearch(text: string, enabled = true): PlaceSearchResult {
  const trimmed = text.trim();
  const debounced = useDebouncedValue(trimmed, PLACE_SEARCH_DEBOUNCE_MS);
  const isValid = SearchPlacesQuerySchema.safeParse({ q: debounced }).success;

  const query = useQuery({
    queryKey: placeKeys.search(debounced),
    queryFn: ({ signal }) => placesService.search(debounced, { signal }),
    enabled: enabled && isValid,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!enabled || trimmed.length === 0) return { status: 'idle', places: [] };
  if (trimmed.length < PLACE_SEARCH_MIN_LENGTH) return { status: 'too-short', places: [] };
  // Dentro da janela de debounce o texto digitado ainda não é o consultado.
  if (debounced !== trimmed || query.isPending) return { status: 'loading', places: [] };
  if (query.isError) return { status: 'error', places: [] };
  if (query.data.length === 0) return { status: 'empty', places: [] };
  return { status: 'success', places: query.data };
}
