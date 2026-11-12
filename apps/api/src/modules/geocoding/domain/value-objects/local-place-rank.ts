import type { Place } from '../entities/place.entity';
import { mergePlaces } from './place-merge';

/** Lugar local (parada, estação ou lugar conhecido do OSM) candidato no autocompletar. */
export interface LocalPlaceCandidate {
  place: Place;
  /** Estação de metrô ou trem. */
  isStation: boolean;
  /** Importância da categoria (paradas de ônibus: 0). */
  importance: number;
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 0 quando o nome começa com o texto ou alguma palavra começa com ele; 1 nos demais casos. */
export function textTier(name: string, query: string): number {
  const n = fold(name);
  const q = fold(query);
  if (!q) return 1;
  if (n.startsWith(q)) return 0;
  const index = n.indexOf(q);
  if (index > 0 && !/[\p{L}\p{N}]/u.test(n.charAt(index - 1))) return 0;
  // Ocorrência posterior que comece palavra (ex.: "parque do ibirapuera" com "ibi").
  const words = n.split(/[^\p{L}\p{N}]+/u);
  return words.some((word) => word.startsWith(q)) ? 0 : 1;
}

/**
 * Ordena e junta os candidatos: prefixo ou início de palavra primeiro, depois estações, depois
 * importância da categoria e nome mais curto. Sem repetir o mesmo lugar, até `limit`.
 */
export function rankLocalPlaces(
  query: string,
  candidates: LocalPlaceCandidate[],
  limit: number,
): Place[] {
  const sorted = candidates
    .map((candidate) => ({ candidate, tier: textTier(candidate.place.name, query) }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        Number(b.candidate.isStation) - Number(a.candidate.isStation) ||
        b.candidate.importance - a.candidate.importance ||
        a.candidate.place.name.length - b.candidate.place.name.length ||
        a.candidate.place.name.localeCompare(b.candidate.place.name, 'pt-BR'),
    )
    .map(({ candidate }) => candidate.place);
  return mergePlaces(sorted, [], limit);
}
