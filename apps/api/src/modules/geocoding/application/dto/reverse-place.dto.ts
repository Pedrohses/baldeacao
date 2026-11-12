import type { Coordinates, Place } from '../../domain/entities/place.entity';

export interface ReversePlaceInput {
  location: Coordinates;
}

export interface ReversePlaceOutput {
  /** null quando não há lugar perto do ponto. */
  place: Place | null;
}
