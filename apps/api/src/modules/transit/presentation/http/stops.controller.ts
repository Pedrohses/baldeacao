import { Controller, Get, Param, Query, UseFilters } from '@nestjs/common';
import {
  API_PATHS,
  type NearbyStopsQuery,
  NearbyStopsQuerySchema,
  type NearbyStopsResponse,
  type StopArrivalsResponse,
} from '@baldeacao/types';
import { z } from 'zod';
import { FindNearbyStopsUseCase } from '../../application/use-cases/find-nearby-stops.use-case';
import { GetStopArrivalsUseCase } from '../../application/use-cases/get-stop-arrivals.use-case';
import { DomainErrorFilter } from './domain-error.filter';
import { TransitResponseMapper } from './transit-response.mapper';
import { ZodValidationPipe } from './zod-validation.pipe';

const StopIdSchema = z.string().trim().min(1);

@Controller()
@UseFilters(DomainErrorFilter)
export class StopsController {
  constructor(
    private readonly findNearbyStops: FindNearbyStopsUseCase,
    private readonly getStopArrivals: GetStopArrivalsUseCase,
  ) {}

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

  // API_PATHS.stopArrivals(stopId) === `/stops/${encodeURIComponent(stopId)}/arrivals`
  @Get('/stops/:stopId/arrivals')
  async arrivals(
    @Param('stopId', new ZodValidationPipe(StopIdSchema)) stopId: string,
  ): Promise<StopArrivalsResponse> {
    const result = await this.getStopArrivals.execute({ stopId });
    return {
      stopId: result.stopId,
      arrivals: result.arrivals.map((arrival) => TransitResponseMapper.arrival(arrival)),
    };
  }
}
