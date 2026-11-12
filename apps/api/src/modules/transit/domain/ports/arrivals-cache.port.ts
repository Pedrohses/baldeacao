import type { Arrival } from '../entities/arrival.entity';

export abstract class ArrivalsCache {
  /** null quando não há entrada válida para a parada. */
  abstract get(stopId: string): Promise<Arrival[] | null>;

  abstract set(stopId: string, arrivals: Arrival[], ttlSeconds: number): Promise<void>;
}
