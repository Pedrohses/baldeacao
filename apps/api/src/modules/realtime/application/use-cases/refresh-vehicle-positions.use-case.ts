import { Injectable } from '@nestjs/common';
import { ClockPort } from '../../domain/ports/clock.port';
import {
  PositionsCycleNotifierPort,
  type PositionsCycleEvent,
} from '../../domain/ports/positions-cycle-notifier.port';
import { VehiclePositionsSourcePort } from '../../domain/ports/vehicle-positions-source.port';
import { VehiclePositionsStorePort } from '../../domain/ports/vehicle-positions-store.port';

/**
 * Um ciclo do worker: lê a fonte, substitui a foto no Redis e avisa o gateway.
 * Se a fonte falhar, nada é gravado e o updated_at anterior continua valendo.
 */
@Injectable()
export class RefreshVehiclePositionsUseCase {
  constructor(
    private readonly source: VehiclePositionsSourcePort,
    private readonly store: VehiclePositionsStorePort,
    private readonly notifier: PositionsCycleNotifierPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<PositionsCycleEvent> {
    const vehicles = await this.source.fetchPositions();
    const updatedAt = this.clock.now().toISOString();
    const sourceId = this.source.sourceId;

    await this.store.replace(sourceId, vehicles, updatedAt);
    const event: PositionsCycleEvent = { sourceId, updatedAt, vehicleCount: vehicles.length };
    await this.notifier.publish(event);
    return event;
  }
}
