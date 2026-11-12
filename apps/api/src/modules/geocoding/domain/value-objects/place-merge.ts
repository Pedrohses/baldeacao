import type { Place } from '../entities/place.entity';

/** Dois lugares com nome parecido a menos disso são tratados como o mesmo. */
export const SAME_PLACE_DISTANCE_M = 200;

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

function distanceM(a: Place, b: Place): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.location.lat - a.location.lat);
  const dLon = rad(b.location.lon - a.location.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.location.lat)) * Math.cos(rad(b.location.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}

function isSamePlace(a: Place, b: Place): boolean {
  if (a.id === b.id) return true;
  const nameA = fold(a.name);
  const nameB = fold(b.name);
  const similarName = nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA);
  return similarName && distanceM(a, b) <= SAME_PLACE_DISTANCE_M;
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
