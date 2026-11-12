import type { Place } from '../../domain/entities/place.entity';

export interface SearchPlacesInput {
  /** Texto livre (endereço, lugar ou parada), mínimo 3 caracteres. */
  query: string;
}

export interface SearchPlacesOutput {
  places: Place[];
}
