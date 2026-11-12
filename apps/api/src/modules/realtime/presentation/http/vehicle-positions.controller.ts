import {
  BadRequestException,
  Controller,
  Get,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  API_PATHS,
  VehiclePositionsQuerySchema,
  type ApiErrorBody,
  type VehicleSnapshot,
} from '@baldeacao/types';
import { GetVehicleSnapshotUseCase } from '../../application/use-cases/get-vehicle-snapshot.use-case';
import { RealtimeDataNotReadyError } from '../../domain/errors/realtime-data-not-ready.error';
import { DEFAULT_REALTIME_SOURCE_ID } from '../../domain/realtime-source';

@Controller()
export class VehiclePositionsController {
  constructor(private readonly getSnapshot: GetVehicleSnapshotUseCase) {}

  /** Snapshot de posições: todas as linhas ou só a de `routeId`. */
  @Get(API_PATHS.vehiclePositions)
  async positions(@Query() query: unknown): Promise<VehicleSnapshot> {
    const parsed = VehiclePositionsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_QUERY',
        message: 'Parâmetro routeId inválido.',
      } satisfies ApiErrorBody);
    }
    try {
      return await this.getSnapshot.execute({
        sourceId: DEFAULT_REALTIME_SOURCE_ID,
        routeId: parsed.data.routeId ?? null,
      });
    } catch (error) {
      if (error instanceof RealtimeDataNotReadyError) {
        throw new ServiceUnavailableException({
          code: error.code,
          message: error.message,
        } satisfies ApiErrorBody);
      }
      throw error;
    }
  }
}
