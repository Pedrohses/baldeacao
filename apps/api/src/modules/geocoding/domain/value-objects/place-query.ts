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
