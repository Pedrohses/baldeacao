import { Injectable } from '@nestjs/common';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import { isValidCoordinates } from '../../domain/value-objects/coordinates';
import type { FindAccessStopsInput, FindAccessStopsOutput } from '../dto/transit-queries.dto';

export const ACCESS_STOPS_MAX_RADIUS_M = 5000;

/**
 * Parada e estação de metrô/trem mais próximas de um ponto (PostGIS), para achar por onde se
 * chega a um lugar (terminal, aeroporto, parque) e saber se um ponto é uma estação.
 */
@Injectable()
export class FindAccessStopsUseCase {
  constructor(private readonly stops: StopRepository) {}

  async execute(input: FindAccessStopsInput): Promise<FindAccessStopsOutput> {
    if (!isValidCoordinates(input.center)) {
      throw new InvalidTransitQueryError('Coordenada inválida.');
    }
    if (!(input.radiusM > 0 && input.radiusM <= ACCESS_STOPS_MAX_RADIUS_M)) {
      throw new InvalidTransitQueryError(
        `O raio deve ser maior que zero e no máximo ${ACCESS_STOPS_MAX_RADIUS_M} m.`,
      );
    }
    const [nearest, station] = await Promise.all([
      this.stops.findNearby(input.center, input.radiusM, 1),
      this.stops.findNearestStation(input.center, input.radiusM),
    ]);
    return { stop: nearest[0] ?? null, station };
  }
}
