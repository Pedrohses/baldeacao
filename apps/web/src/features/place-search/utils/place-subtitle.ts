import type { Place } from '@baldeacao/types';

function formatCoordinate(value: number): string {
  return value.toFixed(5).replace('.', ',');
}

/**
 * Linha de apoio abaixo do nome do lugar escolhido: endereço (ou bairro e cidade), "Parada" ou
 * "Estação" (pelo `kind` do contrato) ou as coordenadas. Ajuda a perceber quando se pegou o lugar errado.
 */
export function placeSubtitle(place: Place): string {
  const address = place.address?.trim() || null;
  switch (place.kind) {
    case 'stop':
      return address ? `Parada · ${address}` : 'Parada';
    case 'station':
      return address ? `Estação · ${address}` : 'Estação';
    case 'coordinates':
      return (
        address ??
        `${formatCoordinate(place.location.lat)}; ${formatCoordinate(place.location.lon)}`
      );
    default:
      return address ?? 'São Paulo';
  }
}
