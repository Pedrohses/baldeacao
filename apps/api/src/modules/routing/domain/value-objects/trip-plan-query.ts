import type { Coordinates } from '../entities/itinerary.entity';

/** Quando viajar: sair a partir de, chegar até, ou agora (null). Datas em ISO 8601 com fuso. */
export type TripTime = { departAt: string } | { arriveBy: string } | null;

/** Pedido já validado que o planejador recebe. */
export interface TripPlanQuery {
  from: Coordinates;
  to: Coordinates;
  time: TripTime;
  maxItineraries: number;
}
