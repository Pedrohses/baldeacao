import { Injectable } from '@nestjs/common';
import type { VehicleSnapshot } from '@baldeacao/types';
import { RealtimeDataNotReadyError } from '../../domain/errors/realtime-data-not-ready.error';
import { VehiclePositionsStorePort } from '../../domain/ports/vehicle-positions-store.port';

export interface GetVehicleSnapshotInput {
  sourceId: string;
  /** null para todas as linhas. */
  routeId: string | null;
}

/** Foto atual das posições de uma fonte, de todas as linhas ou de uma só. */
@Injectable()
export class GetVehicleSnapshotUseCase {
  constructor(private readonly store: VehiclePositionsStorePort) {}

  async execute({ sourceId, routeId }: GetVehicleSnapshotInput): Promise<VehicleSnapshot> {
    const { updatedAt, vehicles } = await this.store.read(sourceId);
    if (updatedAt === null) throw new RealtimeDataNotReadyError(sourceId);
    return {
      sourceId,
      routeId,
      updatedAt,
      vehicles: routeId === null ? vehicles : vehicles.filter((v) => v.routeId === routeId),
    };
  }
}
