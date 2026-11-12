import type { Place } from '@baldeacao/types';

/** Minúsculas e sem acento, para comparar o que foi digitado com o nome do lugar. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Divide `name` destacando a primeira ocorrência de `query` (sem diferenciar acento e caixa). */
export function highlightMatch(name: string, query: string): TextSegment[] {
  const q = normalize(query);
  if (!q) return [{ text: name, match: false }];
  // Normaliza caractere a caractere para manter os índices do texto original.
  const chars = Array.from(name);
  const folded = chars.map((c) => normalize(c) || c);
  const haystack = folded.join('');
  const at = haystack.indexOf(q);
  if (at < 0) return [{ text: name, match: false }];

  let position = 0;
  let startChar = -1;
  let endChar = chars.length;
  for (let i = 0; i < folded.length; i++) {
    if (position === at) startChar = i;
    position += folded[i]!.length;
    if (startChar >= 0 && position >= at + q.length) {
      endChar = i + 1;
      break;
    }
  }
  if (startChar < 0) return [{ text: name, match: false }];
  return [
    { text: chars.slice(0, startChar).join(''), match: false },
    { text: chars.slice(startChar, endChar).join(''), match: true },
    { text: chars.slice(endChar).join(''), match: false },
  ].filter((segment) => segment.text.length > 0);
}

// Palavras que não identificam o lugar: preposições e tipos de logradouro (abreviados ou não).
const IGNORED_TERMS = new Set([
  'a',
  'o',
  'e',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'r',
  'rua',
  'av',
  'avenida',
  'al',
  'alameda',
  'pca',
  'praca',
  'tv',
  'travessa',
  'estr',
  'estrada',
  'lgo',
  'largo',
  'rod',
  'rodovia',
]);

// Caixa do município de São Paulo (aproximada): resultado fora dela não é escolhido sozinho.
const SAO_PAULO_BOUNDS = { south: -24.01, north: -23.35, west: -46.83, east: -46.36 };

/** Termos que identificam o lugar no texto digitado, já normalizados. */
export function significantTerms(query: string): string[] {
  return normalize(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0 && !IGNORED_TERMS.has(term));
}

export function isInSaoPaulo(place: Place): boolean {
  const { lat, lon } = place.location;
  const b = SAO_PAULO_BOUNDS;
  return lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;
}

/**
 * Resultado "forte" para o texto digitado: todos os termos aparecem no nome ou no endereço (sem
 * acento) e o lugar fica em São Paulo. Só esse é escolhido sem perguntar.
 */
export function isStrongMatch(place: Place, query: string): boolean {
  const terms = significantTerms(query);
  if (terms.length === 0 || !isInSaoPaulo(place)) return false;
  const haystack = normalize(`${place.name} ${place.address ?? ''}`);
  return terms.every((term) => haystack.includes(term));
}

/**
 * Resultado da busca confirmada para o texto digitado: escolhe o primeiro só se ele for forte
 * (ver `isStrongMatch`) e não tiver homônimo (mesmo nome, ex.: a mesma rua em dois bairros).
 * Senão devolve 'ambiguous' e a pessoa escolhe na lista.
 */
export function pickConfirmed(places: readonly Place[], query: string): Place | 'ambiguous' | null {
  const [first, second] = places;
  if (!first) return null;
  if (!isStrongMatch(first, query)) return 'ambiguous';
  if (second && normalize(second.name) === normalize(first.name)) return 'ambiguous';
  return first;
}
