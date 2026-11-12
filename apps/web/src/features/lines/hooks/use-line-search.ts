'use client';

import { SearchLinesQuerySchema, type Route } from '@baldeacao/types';
import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';

import { lineKeys, linesService } from '../services';

export const LINE_SEARCH_DEBOUNCE_MS = 300;
export const LINE_SEARCH_MIN_LENGTH = 2;

export type LineSearchStatus = 'idle' | 'too-short' | 'loading' | 'error' | 'empty' | 'success';

export interface LineSearchResult {
  status: LineSearchStatus;
  lines: Route[];
  /** Texto (aparado) a que `lines` corresponde. */
  query: string;
  retry: () => void;
}

/** Busca de linha por código ou nome, com espera de LINE_SEARCH_DEBOUNCE_MS sem digitação. */
export function useLineSearch(text: string): LineSearchResult {
  const trimmed = text.trim();
  const debounced = useDebouncedValue(trimmed, LINE_SEARCH_DEBOUNCE_MS);
  const isValid = SearchLinesQuerySchema.safeParse({ q: debounced }).success;

  const query = useQuery({
    queryKey: lineKeys.search(debounced),
    queryFn: ({ signal }) => linesService.search(debounced, { signal }),
    enabled: isValid,
    staleTime: 60 * 60 * 1000, // a lista de linhas muda raramente
    retry: false,
  });

  const retry = () => void query.refetch();
  if (trimmed === '') return { status: 'idle', lines: [], query: '', retry };
  if (trimmed.length < LINE_SEARCH_MIN_LENGTH) {
    return { status: 'too-short', lines: [], query: trimmed, retry };
  }
  // Enquanto o texto ainda não assentou, o resultado anterior não vale para ele.
  if (debounced !== trimmed || query.isPending) {
    return { status: 'loading', lines: [], query: trimmed, retry };
  }
  if (query.isError) return { status: 'error', lines: [], query: trimmed, retry };
  const lines = query.data ?? [];
  return { status: lines.length > 0 ? 'success' : 'empty', lines, query: trimmed, retry };
}
