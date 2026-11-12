import type { Itinerary } from '../entities/itinerary.entity';
import type { TripPlanQuery } from '../value-objects/trip-plan-query';

/** Planejador de viagem (OpenTripPlanner). */
export abstract class TripPlanner {
  /**
   * Até `query.maxItineraries` itinerários; lista vazia quando não há caminho.
   * Planejador indisponível ou não configurado vira SourceUnavailableError.
   */
  abstract plan(query: TripPlanQuery): Promise<Itinerary[]>;
}
