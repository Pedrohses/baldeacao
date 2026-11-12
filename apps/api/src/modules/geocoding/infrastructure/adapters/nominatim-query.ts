/**
 * Normaliza endereços no formato do Google ("Av. X, 3031 - Bairro, São Paulo - SP, 04301-905"),
 * que o Nominatim não entende, para "Av. X, 3031, Bairro, São Paulo".
 */
export function normalizeAddressQuery(query: string): string {
  return query
    .replace(/\b\d{5}-?\d{3}\b/g, ' ') // CEP
    .replace(/\s+-\s+/g, ', ') // " - " separa bairro e UF
    .replace(/,?\s*\b(SP|São Paulo - SP|Brasil|Brazil)\s*$/i, '')
    .split(',')
    .map((part) => part.trim())
    .filter(
      (part, i, parts) =>
        part.length > 0 && !(part.toUpperCase() === 'SP' && i > 0) && parts.indexOf(part) === i,
    )
    .join(', ');
}

/**
 * Consulta reduzida para a segunda tentativa: só rua e número (as duas primeiras partes,
 * quando a segunda é número) mais a cidade. Devolve null quando não há o que reduzir.
 */
export function streetOnlyQuery(normalized: string): string | null {
  const parts = normalized.split(',').map((part) => part.trim());
  if (parts.length < 3) return null;
  const head = /^\d+[a-zA-Z]?$/.test(parts[1] ?? '') ? parts.slice(0, 2) : parts.slice(0, 1);
  return [...head, 'São Paulo'].join(', ');
}

const POSTAL_CODE_ONLY = /^\s*(?:cep\s*:?\s*)?(\d{5})-?(\d{3})\s*$/i;

/** "01310-200" (ou "01310200", "CEP 01310-200") vira "01310-200"; null se não for só CEP. */
export function postalCodeOnly(query: string): string | null {
  const match = POSTAL_CODE_ONLY.exec(query);
  return match ? `${match[1]}-${match[2]}` : null;
}
