import { Injectable } from '@nestjs/common';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import { isValidCoordinates } from '../../domain/value-objects/coordinates';
import type { HasNearbyStopInput, HasNearbyStopOutput } from '../dto/transit-queries.dto';

export const HAS_NEARBY_STOP_MAX_RADIUS_M = 5000;

/** Se há parada a até um raio do ponto (área atendida pela rede), via PostGIS. */
@Injectable()
export class HasNearbyStopUseCase {
  constructor(private readonly stops: StopRepository) {}

  async execute(input: HasNearbyStopInput): Promise<HasNearbyStopOutput> {
    if (!isValidCoordinates(input.center)) {
      throw new InvalidTransitQueryError('Coordenada inválida.');
    }
    if (!(input.radiusM > 0 && input.radiusM <= HAS_NEARBY_STOP_MAX_RADIUS_M)) {
      throw new InvalidTransitQueryError(
        `O raio deve ser maior que zero e no máximo ${HAS_NEARBY_STOP_MAX_RADIUS_M} m.`,
      );
    }
    return { hasStop: await this.stops.existsWithin(input.center, input.radiusM) };
  }
}
