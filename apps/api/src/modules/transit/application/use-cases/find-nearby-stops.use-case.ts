import { Injectable } from '@nestjs/common';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import { isValidCoordinates } from '../../domain/value-objects/coordinates';
import type { FindNearbyStopsInput, FindNearbyStopsOutput } from '../dto/transit-queries.dto';

export const NEARBY_DEFAULT_RADIUS_M = 500;
export const NEARBY_MAX_RADIUS_M = 2000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class FindNearbyStopsUseCase {
  constructor(private readonly stops: StopRepository) {}

  async execute(input: FindNearbyStopsInput): Promise<FindNearbyStopsOutput> {
    if (!isValidCoordinates(input.center)) {
      throw new InvalidTransitQueryError('Coordenada inválida.');
    }
    const radiusM = input.radiusM ?? NEARBY_DEFAULT_RADIUS_M;
    if (!(radiusM > 0 && radiusM <= NEARBY_MAX_RADIUS_M)) {
      throw new InvalidTransitQueryError(
        `O raio deve ser maior que zero e no máximo ${NEARBY_MAX_RADIUS_M} m.`,
      );
    }
    const limit = Math.min(Math.max(1, Math.trunc(input.limit ?? DEFAULT_LIMIT)), MAX_LIMIT);
    return { stops: await this.stops.findNearby(input.center, radiusM, limit) };
  }
}
