import type { Place } from '@baldeacao/types';

// Pontos de ônibus da SPTrans têm nome de logradouro ("R. Augusta, 304"); estações não.
const STREET_NAME =
  /^(r\.|rua|av\.?|avenida|al\.?|alameda|estr\.?|estrada|pça\.?|praça|tv\.?|travessa|rod\.?|rodovia|lgo\.?|largo|vd\.?|viaduto|pte\.?|ponte)\s/i;

/** "Parada" para ponto de ônibus, "Estação" para metrô, trem ou terminal. */
export function stopKindLabel(name: string): 'Parada' | 'Estação' {
  const trimmed = name.trim();
  return STREET_NAME.test(trimmed) || /,\s*\d/.test(trimmed) ? 'Parada' : 'Estação';
}

function formatCoordinate(value: number): string {
  return value.toFixed(5).replace('.', ',');
}

/**
 * Linha de apoio abaixo do nome do lugar escolhido: endereço (ou bairro e cidade), o tipo da
 * parada ou as coordenadas. Ajuda a perceber quando se pegou o lugar errado.
 */
export function placeSubtitle(place: Place): string {
  const address = place.address?.trim() || null;
  switch (place.kind) {
    case 'stop': {
      const label = stopKindLabel(place.name);
      return address ? `${label} · ${address}` : label;
    }
    case 'coordinates':
      return (
        address ??
        `${formatCoordinate(place.location.lat)}; ${formatCoordinate(place.location.lon)}`
      );
    default:
      return address ?? 'São Paulo';
  }
}
