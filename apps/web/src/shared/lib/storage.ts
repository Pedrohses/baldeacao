import { StopSchema, type Stop } from '@baldeacao/types';
import { z } from 'zod';

// Único ponto de acesso ao localStorage: modo privado, cota cheia e dado corrompido
// nunca derrubam a tela; o que não passa no schema é tratado como ausente.
const PREFIX = 'baldeacao:';

function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function readStorage<S extends z.ZodType>(key: string, schema: S): z.output<S> | null {
  try {
    const raw = getStorage()?.getItem(storageKey(key));
    if (raw == null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(storageKey(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  try {
    getStorage()?.removeItem(storageKey(key));
  } catch {
    // sem armazenamento disponível: nada a remover
  }
}

// Paradas favoritas: lista de Stop validada na leitura; itens inválidos derrubam a lista toda.
export const FAVORITE_STOPS_KEY = 'favorite-stops';
export const FAVORITE_STOPS_MAX = 50;
const FavoriteStopsSchema = z.array(StopSchema);

export function readFavoriteStops(): Stop[] {
  return readStorage(FAVORITE_STOPS_KEY, FavoriteStopsSchema) ?? [];
}

/** Salva a parada (no topo); já salva, só a move para o topo. */
export function saveFavoriteStop(stop: Stop): boolean {
  const next = [stop, ...readFavoriteStops().filter((s) => s.id !== stop.id)].slice(
    0,
    FAVORITE_STOPS_MAX,
  );
  return writeStorage(FAVORITE_STOPS_KEY, next);
}

export function removeFavoriteStop(stopId: string): boolean {
  return writeStorage(
    FAVORITE_STOPS_KEY,
    readFavoriteStops().filter((s) => s.id !== stopId),
  );
}
