/**
 * Consulta normalizada, usada como chave do cache e enviada à fonte: Unicode NFC, sem espaços
 * nas pontas, espaços internos colapsados e minúsculas. Acentos são mantidos ("Sé" e "Se"
 * podem ser lugares diferentes).
 */
export function normalizePlaceQuery(query: string): string {
  return query.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}
