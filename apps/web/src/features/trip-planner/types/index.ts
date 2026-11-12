import type { Place } from '@baldeacao/types';
import type { ReactNode } from 'react';

/**
 * Props que o TripForm entrega ao campo de lugar. O campo vem de fora (a página passa o
 * PlaceAutocomplete) porque uma feature não importa outra.
 */
export interface PlaceInputProps {
  id: string;
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
}

export type RenderPlaceInput = (props: PlaceInputProps) => ReactNode;
