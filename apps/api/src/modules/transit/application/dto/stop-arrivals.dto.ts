import type { Arrival } from '../../domain/entities/arrival.entity';

export interface GetStopArrivalsInput {
  stopId: string;
}

export interface GetStopArrivalsOutput {
  stopId: string;
  /** Ordenadas por expectedAt. */
  arrivals: Arrival[];
}
