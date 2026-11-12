import type { Coordinates, Itinerary } from '../../domain/entities/itinerary.entity';
import type { PlanTripNotice } from '../../domain/value-objects/plan-trip-notice';

export interface PlanTripInput {
  from: Coordinates;
  to: Coordinates;
  /** Sair a partir de (ISO 8601 com fuso). Exclusivo com `arriveBy`. */
  departAt?: string;
  /** Chegar até (ISO 8601 com fuso). Exclusivo com `departAt`. */
  arriveBy?: string;
  /** Padrão 3, de 1 a 5. */
  maxItineraries?: number;
}

export interface PlanTripOutput {
  itineraries: Itinerary[];
  /** Avisos (área atendida, data fora da validade do GTFS, hora movida); vazio sem nada a avisar. */
  notices: PlanTripNotice[];
}
