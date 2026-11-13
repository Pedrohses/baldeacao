import type { Place } from '../entities/place.entity';
import { distanceM } from './service-city';

/** Dois lugares com nome parecido a menos disso são tratados como o mesmo. */
export const SAME_PLACE_DISTANCE_M = 200;
/**
 * Tipo compatível e mesmo nome sem espaço, hífen e pontuação ("Palmeiras - Barra Funda" e
 * "Palmeiras-Barra Funda") a menos disso: o mesmo lugar.
 */
export const SAME_NAME_DISTANCE_M = 300;

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(text: string): string {
  return fold(text).replace(/[^\p{L}\p{N}]+/gu, '');
}

// Estação e POI (a estação no Nominatim vem às vezes como POI) podem ser o mesmo lugar.
const STATION_LIKE: ReadonlySet<string> = new Set(['station', 'poi']);

function compatibleKinds(a: Place, b: Place): boolean {
  return a.kind === b.kind || (STATION_LIKE.has(a.kind) && STATION_LIKE.has(b.kind));
}

function isSamePlace(a: Place, b: Place): boolean {
  if (a.id === b.id) return true;
  const distance = distanceM(a.location, b.location);
  // Parada de ônibus e endereço só com o mesmo tipo: a parada "Estádio do Morumbis" fica.
  const sameCompactName = compatibleKinds(a, b) && compact(a.name) === compact(b.name);
  if (sameCompactName && distance <= SAME_NAME_DISTANCE_M) return true;
  const nameA = fold(a.name);
  const nameB = fold(b.name);
  const similarName = nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA);
  return similarName && distance <= SAME_PLACE_DISTANCE_M;
}

/** Junta as listas na ordem dada (`primary` primeiro), sem repetir o mesmo lugar, até `limit`. */
export function mergePlaces(primary: Place[], secondary: Place[], limit: number): Place[] {
  const merged: Place[] = [];
  for (const place of [...primary, ...secondary]) {
    if (merged.length >= limit) break;
    if (!merged.some((kept) => isSamePlace(kept, place))) merged.push(place);
  }
  return merged;
}
