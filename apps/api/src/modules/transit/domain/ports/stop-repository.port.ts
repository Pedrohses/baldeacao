import type { NearbyStop, Stop } from '../entities/stop.entity';
import type { Coordinates } from '../value-objects/coordinates';

export abstract class StopRepository {
  /** Paradas a até `radiusM` metros de `center`, da mais próxima para a mais distante. */
  abstract findNearby(center: Coordinates, radiusM: number, limit: number): Promise<NearbyStop[]>;

  /**
   * Paradas cujo nome contém `text` (sem acento nem caixa, tolerando erro de digitação).
   * Estações de metrô/trem primeiro (uma por nome), depois nomes mais curtos.
   */
  abstract searchByName(text: string, limit: number): Promise<Stop[]>;
}
