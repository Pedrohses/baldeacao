import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.module';
import { withTimeout } from '../../../../shared/infrastructure/with-timeout';
import { CacheHealthPort } from '../../domain/ports/cache-health.port';

const TIMEOUT_MS = 2_000;

@Injectable()
export class RedisHealthAdapter extends CacheHealthPort {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isUp(): Promise<boolean> {
    const reply = await withTimeout(this.redis.ping(), TIMEOUT_MS);
    return reply === 'PONG';
  }
}
