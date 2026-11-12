import type { Place } from '@baldeacao/types';

/** Minúsculas e sem acento, para comparar o que foi digitado com o nome do lugar. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
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

/**
 * Resultado da busca confirmada: escolhe o primeiro, a não ser que haja homônimos (mesmo nome,
 * ex.: a mesma rua em dois bairros). Aí a pessoa escolhe na lista.
 */
export function pickConfirmed(places: readonly Place[]): Place | 'ambiguous' | null {
  const [first, second] = places;
  if (!first) return null;
  if (second && normalize(second.name) === normalize(first.name)) return 'ambiguous';
  return first;
}
