import { Controller, Get, Query, UseFilters } from '@nestjs/common';
import {
  API_PATHS,
  type NearbyStopsQuery,
  NearbyStopsQuerySchema,
  type NearbyStopsResponse,
} from '@baldeacao/types';
import { FindNearbyStopsUseCase } from '../../application/use-cases/find-nearby-stops.use-case';
import { DomainErrorFilter } from './domain-error.filter';
import { TransitResponseMapper } from './transit-response.mapper';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller()
@UseFilters(DomainErrorFilter)
export class StopsController {
  constructor(private readonly findNearbyStops: FindNearbyStopsUseCase) {}

  @Get(API_PATHS.nearbyStops)
  async nearby(
    @Query(new ZodValidationPipe(NearbyStopsQuerySchema)) query: NearbyStopsQuery,
  ): Promise<NearbyStopsResponse> {
    const { stops } = await this.findNearbyStops.execute({
      center: { lat: query.lat, lon: query.lon },
      radiusM: query.radius,
    });
    return { stops: stops.map((stop) => TransitResponseMapper.nearbyStop(stop)) };
  }
}
