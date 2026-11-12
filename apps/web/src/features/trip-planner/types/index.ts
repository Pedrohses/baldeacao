import type { Place } from '@baldeacao/types';
import type { ReactNode } from 'react';

/**
 * Props que o TripForm entrega ao campo de lugar. O campo vem de fora (a página passa o
 * PlaceAutocomplete) porque uma feature não importa outra.
 */
export interface PlaceInputProps {
  id: string;
  /** Nome acessível ("Origem", "Destino"); o visual fica no placeholder. */
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onPickOnMap?: () => void;
  /** Trocar o número pede o foco no campo (ex.: "Editar destino" num aviso). */
  focusKey?: number;
}

export type RenderPlaceInput = (props: PlaceInputProps) => ReactNode;

export type TripField = 'origin' | 'destination';
