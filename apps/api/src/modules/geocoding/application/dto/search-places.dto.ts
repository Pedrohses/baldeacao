import type { Place } from '../../domain/entities/place.entity';

/** `quick`: só paradas locais (autocompletar). `full`: locais primeiro + Nominatim. */
export type SearchPlacesMode = 'quick' | 'full';

export interface SearchPlacesInput {
  /** Texto livre (endereço, lugar ou parada), mínimo 2 caracteres (3 para consultar o Nominatim). */
  query: string;
  mode: SearchPlacesMode;
}

export interface SearchPlacesOutput {
  places: Place[];
}
