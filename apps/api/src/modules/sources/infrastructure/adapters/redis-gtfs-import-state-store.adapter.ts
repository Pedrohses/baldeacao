import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.module';
import {
  GtfsImportStateStore,
  type GtfsImportState,
} from '../../domain/ports/gtfs-import-state-store.port';

const key = (sourceId: string): string => `gtfs:${sourceId}:import`;

@Injectable()
export class RedisGtfsImportStateStore extends GtfsImportStateStore {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async get(sourceId: string): Promise<GtfsImportState | null> {
    const [sha256, importedAt] = await this.redis.hmget(key(sourceId), 'sha256', 'importedAt');
    return sha256 && importedAt ? { sha256, importedAt } : null;
  }

  async save(sourceId: string, state: GtfsImportState): Promise<void> {
    await this.redis.hset(key(sourceId), { sha256: state.sha256, importedAt: state.importedAt });
  }
}
