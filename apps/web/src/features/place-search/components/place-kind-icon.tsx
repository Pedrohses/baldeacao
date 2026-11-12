import type { PlaceKind } from '@baldeacao/types';

import { CrosshairIcon, PinIcon, StopSignIcon, StreetSignIcon } from '@/shared/ui/icons';

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  address: 'Endereço',
  poi: 'Lugar',
  stop: 'Parada ou estação',
  coordinates: 'Coordenadas',
};

/** Ícone do tipo de lugar: placa de rua, alfinete, placa de parada ou mira. */
export function PlaceKindIcon({ kind, className }: { kind: PlaceKind; className?: string }) {
  const props = className ? { className } : {};
  switch (kind) {
    case 'address':
      return <StreetSignIcon {...props} />;
    case 'stop':
      return <StopSignIcon {...props} />;
    case 'coordinates':
      return <CrosshairIcon {...props} />;
    default:
      return <PinIcon {...props} />;
  }
}
