import type { Itinerary } from '../entities/itinerary.entity';
import type { TripPlanQuery } from '../value-objects/trip-plan-query';

/** Planejador de viagem (OpenTripPlanner). */
export abstract class TripPlanner {
  /**
   * Até `query.candidates` itinerários (podem repetir as linhas em saídas seguintes); lista vazia quando não há caminho.
   * Planejador indisponível ou não configurado vira SourceUnavailableError.
   */
  abstract plan(query: TripPlanQuery): Promise<Itinerary[]>;
}
