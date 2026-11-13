/**
 * Consulta normalizada, usada como chave do cache e enviada à fonte: Unicode NFC, sem espaços
 * nas pontas, espaços internos colapsados e minúsculas. Acentos são mantidos ("Sé" e "Se"
 * podem ser lugares diferentes).
 */
export function normalizePlaceQuery(query: string): string {
  return query.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

/** Consulta que é só um CEP ("01310-200", "01310200", "CEP 01310-200"). */
export function isPostalCodeQuery(query: string): boolean {
  return /^\s*(?:cep\s*:?\s*)?\d{5}-?\d{3}\s*$/i.test(query);
}

// "esquina da Paulista com a Consolação", "Paulista com Consolação", "Paulista x Consolação".
const INTERSECTION =
  /^(?:esquina\s+(?:d[aeo]s?\s+)?)?(.+?)\s+(?:com|x)\s+(?:(?:a|o|as|os)\s+)?(.+)$/u;
const CORNER_PREFIX = /^esquina\s/u;

/**
 * Esquina pedida em texto: as duas vias, ou null. Sem "esquina", só "X com Y" e "X x Y" em que
 * os dois lados têm pelo menos 3 letras (normalizada por normalizePlaceQuery).
 */
export function parseIntersectionQuery(normalized: string): [string, string] | null {
  const match = INTERSECTION.exec(normalized);
  if (!match) return null;
  const first = match[1]?.trim() ?? '';
  const second = match[2]?.trim() ?? '';
  if (first.length < 3 || second.length < 3) return null;
  if (!CORNER_PREFIX.test(normalized) && /\d/.test(first + second)) return null;
  return [first, second];
}
