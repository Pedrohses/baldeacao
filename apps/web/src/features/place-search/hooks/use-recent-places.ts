'use client';

import { PlaceSchema, type Place } from '@baldeacao/types';
import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';

import { readStorage, storageKey, writeStorage } from '@/shared/lib/storage';

export const RECENT_PLACES_KEY = 'recent-places';
export const RECENT_PLACES_MAX = 5;

const RecentPlacesSchema = z.array(PlaceSchema);
const EMPTY: readonly Place[] = [];

// Cache do snapshot: useSyncExternalStore exige a mesma referência enquanto nada muda.
let cached: readonly Place[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly Place[] {
  cached ??= readStorage(RECENT_PLACES_KEY, RecentPlacesSchema) ?? EMPTY;
  return cached;
}

function notify() {
  cached = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Outra aba gravou: relê.
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(RECENT_PLACES_KEY)) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Coordenadas soltas (GPS, ponto no mapa) mudam a cada uso: não viram recente. */
export function isRememberable(place: Place): boolean {
  return place.kind !== 'coordinates';
}

export function addRecentPlace(place: Place): void {
  if (!isRememberable(place)) return;
  const next = [place, ...read().filter((p) => p.id !== place.id)].slice(0, RECENT_PLACES_MAX);
  writeStorage(RECENT_PLACES_KEY, next);
  notify();
}

/** Só para testes: esquece o cache em memória. */
export function resetRecentPlacesCache() {
  cached = null;
}

/** Últimos lugares escolhidos (até 5, mais recente primeiro), guardados no aparelho. */
export function useRecentPlaces() {
  const recents = useSyncExternalStore(subscribe, read, () => EMPTY);
  const add = useCallback((place: Place) => addRecentPlace(place), []);
  return { recents, addRecent: add };
}
