import { Inject, Injectable } from '@nestjs/common';
import { VehiclePositionSchema, type VehiclePosition } from '@baldeacao/types';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.module';
import {
  VehiclePositionsStorePort,
  type StoredPositions,
} from '../../domain/ports/vehicle-positions-store.port';
import { realtimeKeys } from './redis-keys';

/**
 * Detalhes de cada veículo expiram depois de alguns ciclos sem leitura; o conjunto GEO é
 * trocado inteiro a cada ciclo, então veículo que saiu da fonte some na hora.
 */
export const VEHICLE_DETAILS_TTL_S = 300;
const COORDINATE_DECIMALS = 6;

const VehicleDetailsSchema = VehiclePositionSchema.pick({
  routeId: true,
  routeShortName: true,
  directionId: true,
  accessible: true,
  recordedAt: true,
});

@Injectable()
export class RedisVehiclePositionsStoreAdapter extends VehiclePositionsStorePort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async replace(sourceId: string, vehicles: VehiclePosition[], updatedAt: string): Promise<void> {
    const geoKey = realtimeKeys.vehicles(sourceId);
    const nextKey = `${geoKey}:next`;
    // MULTI: quem lê vê a foto anterior ou a nova, nunca metade.
    const tx = this.redis.multi().del(nextKey);
    if (vehicles.length > 0) {
      const members = vehicles.flatMap((v) => [v.location.lon, v.location.lat, v.vehicleId]);
      tx.geoadd(nextKey, ...members);
      for (const v of vehicles) {
        const details = {
          routeId: v.routeId,
          routeShortName: v.routeShortName,
          directionId: v.directionId,
          accessible: v.accessible,
          recordedAt: v.recordedAt,
        };
        tx.set(
          realtimeKeys.vehicle(sourceId, v.vehicleId),
          JSON.stringify(details),
          'EX',
          VEHICLE_DETAILS_TTL_S,
        );
      }
      tx.rename(nextKey, geoKey);
    } else {
      tx.del(geoKey);
    }
    tx.set(realtimeKeys.updatedAt(sourceId), updatedAt);

    const results = await tx.exec();
    const failure = results?.find(([error]) => error !== null)?.[0];
    if (failure) throw failure;
  }

  async read(sourceId: string): Promise<StoredPositions> {
    const geoKey = realtimeKeys.vehicles(sourceId);
    const [updatedAt, ids] = await Promise.all([
      this.redis.get(realtimeKeys.updatedAt(sourceId)),
      this.redis.zrange(geoKey, '0', '-1'),
    ]);
    if (ids.length === 0) return { updatedAt, vehicles: [] };

    const [coordinates, details] = await Promise.all([
      this.redis.geopos(geoKey, ...ids),
      this.redis.mget(ids.map((id) => realtimeKeys.vehicle(sourceId, id))),
    ]);

    const vehicles: VehiclePosition[] = [];
    ids.forEach((vehicleId, i) => {
      const point = coordinates[i];
      const raw = details[i];
      // Veículo trocado de foto entre as leituras ou com detalhe expirado fica de fora.
      if (!point || !raw) return;
      const parsed = VehicleDetailsSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return;
      vehicles.push({
        vehicleId,
        sourceId,
        ...parsed.data,
        location: { lat: round(Number(point[1])), lon: round(Number(point[0])) },
      });
    });
    return { updatedAt, vehicles };
  }
}

function round(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}
