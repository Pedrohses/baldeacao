'use client';

import { RouteSchema, type Route } from '@baldeacao/types';
import { useCallback, useSyncExternalStore } from 'react';
import { z } from 'zod';

import { readStorage, storageKey, writeStorage } from '@/shared/lib/storage';

export const RECENT_LINES_KEY = 'recent-lines';
export const RECENT_LINES_MAX = 5;

const RecentLinesSchema = z.array(RouteSchema);
const EMPTY: readonly Route[] = [];

// Cache do snapshot: useSyncExternalStore exige a mesma referência enquanto nada muda.
let cached: readonly Route[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly Route[] {
  cached ??= readStorage(RECENT_LINES_KEY, RecentLinesSchema) ?? EMPTY;
  return cached;
}

function notify() {
  cached = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey(RECENT_LINES_KEY)) notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Guarda a linha aberta no topo das recentes (sem repetir). */
export function addRecentLine(line: Route): void {
  const current = read();
  if (current[0]?.id === line.id) return;
  const next = [line, ...current.filter((l) => l.id !== line.id)].slice(0, RECENT_LINES_MAX);
  writeStorage(RECENT_LINES_KEY, next);
  notify();
}

/** Só para testes: esquece o cache em memória. */
export function resetRecentLinesCache() {
  cached = null;
}

/** Últimas linhas abertas (até 5, mais recente primeiro), guardadas no aparelho. */
export function useRecentLines() {
  const recents = useSyncExternalStore(subscribe, read, () => EMPTY);
  const add = useCallback((line: Route) => addRecentLine(line), []);
  return { recents, addRecent: add };
}
