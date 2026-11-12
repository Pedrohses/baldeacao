import { Injectable } from '@nestjs/common';
import {
  POSITIONS_ALL_CHANNEL,
  POSITIONS_LINE_CHANNEL_PREFIX,
  type PositionsChannel,
  type PositionsUpdate,
} from '@baldeacao/types';
import { VehiclePositionsStorePort } from '../../domain/ports/vehicle-positions-store.port';

export interface BuildChannelUpdatesInput {
  sourceId: string;
  channels: PositionsChannel[];
}

/**
 * Monta o positions:update de cada canal a partir de uma única leitura do Redis:
 * a foto completa do canal, não um diff. Sem dado bom ainda, não há o que publicar.
 */
@Injectable()
export class BuildChannelUpdatesUseCase {
  constructor(private readonly store: VehiclePositionsStorePort) {}

  async execute({ sourceId, channels }: BuildChannelUpdatesInput): Promise<PositionsUpdate[]> {
    if (channels.length === 0) return [];
    const { updatedAt, vehicles } = await this.store.read(sourceId);
    if (updatedAt === null) return [];

    return [...new Set(channels)].map((channel) => {
      const routeId =
        channel === POSITIONS_ALL_CHANNEL
          ? null
          : channel.slice(POSITIONS_LINE_CHANNEL_PREFIX.length);
      return {
        channel,
        sourceId,
        routeId,
        updatedAt,
        vehicles: routeId === null ? vehicles : vehicles.filter((v) => v.routeId === routeId),
      };
    });
  }
}
