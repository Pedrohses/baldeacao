import type { NearbyStop } from '../entities/stop.entity';
import type { Coordinates } from '../value-objects/coordinates';

export abstract class StopRepository {
  /** Paradas a até `radiusM` metros de `center`, da mais próxima para a mais distante. */
  abstract findNearby(center: Coordinates, radiusM: number, limit: number): Promise<NearbyStop[]>;
}
