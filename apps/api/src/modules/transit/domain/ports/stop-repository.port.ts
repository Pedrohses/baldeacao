import type { NearbyStop, StopNameMatch } from '../entities/stop.entity';
import type { Coordinates } from '../value-objects/coordinates';

export abstract class StopRepository {
  /** Paradas a até `radiusM` metros de `center`, da mais próxima para a mais distante. */
  abstract findNearby(center: Coordinates, radiusM: number, limit: number): Promise<NearbyStop[]>;

  /**
   * Estação de metrô ou trem (parada servida por rota de route_type 1 ou 2) mais próxima de
   * `center` a até `radiusM` metros, ou null.
   */
  abstract findNearestStation(center: Coordinates, radiusM: number): Promise<NearbyStop | null>;

  /**
   * Paradas cujo nome contém `text` (sem acento nem caixa, tolerando erro de digitação).
   * Estações de metrô/trem primeiro (uma por nome), depois nomes mais curtos.
   */
  abstract searchByName(text: string, limit: number): Promise<StopNameMatch[]>;

  /** Se a parada (stop_id do GTFS) existe. */
  abstract exists(stopId: string): Promise<boolean>;

  /** Se há pelo menos uma parada a até `radiusM` metros de `center`. */
  abstract existsWithin(center: Coordinates, radiusM: number): Promise<boolean>;
}
