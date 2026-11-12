import { Injectable } from '@nestjs/common';
import type { VehiclePosition } from '@baldeacao/types';
import { OlhoVivoClient } from '../../../../shared/infrastructure/olho-vivo/olho-vivo.client';
import { DEFAULT_REALTIME_SOURCE_ID } from '../../domain/realtime-source';
import { VehiclePositionsSourcePort } from '../../domain/ports/vehicle-positions-source.port';
import { mapOlhoVivoPositions } from './olho-vivo-position.mapper';

/** Posições da SPTrans via Olho Vivo (timeout, retry e re-login ficam no OlhoVivoClient). */
@Injectable()
export class OlhoVivoVehiclePositionsAdapter extends VehiclePositionsSourcePort {
  readonly sourceId = DEFAULT_REALTIME_SOURCE_ID;

  constructor(private readonly client: OlhoVivoClient) {
    super();
  }

  async fetchPositions(): Promise<VehiclePosition[]> {
    return mapOlhoVivoPositions(await this.client.getPositions(), this.sourceId);
  }
}
