'use client';

import type { Stop } from '@baldeacao/types';
import { useCallback, useSyncExternalStore } from 'react';

import {
  FAVORITE_STOPS_KEY,
  readFavoriteStops,
  removeFavoriteStop,
  saveFavoriteStop,
  storageKey,
} from '@/shared/lib/storage';

const EMPTY: readonly Stop[] = [];

// Cache do snapshot: useSyncExternalStore exige a mesma referência enquanto nada muda.
let cached: readonly Stop[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly Stop[] {
  cached ??= readFavoriteStops();
  return cached;
}

function notify() {
  cached = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(FAVORITE_STOPS_KEY)) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Só para testes: esquece o cache em memória. */
export function resetFavoriteStopsCache() {
  cached = null;
}

/** Paradas favoritas guardadas no aparelho (mais recente primeiro). */
export function useFavoriteStops() {
  const stops = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((stop: Stop) => {
    const saved = read().some((s) => s.id === stop.id);
    if (saved) removeFavoriteStop(stop.id);
    else saveFavoriteStop(stop);
    notify();
  }, []);
  const isFavorite = useCallback((stopId: string) => stops.some((s) => s.id === stopId), [stops]);
  return { stops, isFavorite, toggle };
}
