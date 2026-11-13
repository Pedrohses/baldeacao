import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { z } from 'zod';
import { REDIS_CLIENT } from '../../../../shared/infrastructure/redis/redis.module';
import { withTimeout } from '../../../../shared/infrastructure/with-timeout';
import { Arrival } from '../../domain/entities/arrival.entity';
import { ArrivalsCache } from '../../domain/ports/arrivals-cache.port';

const KEY_PREFIX = 'arrivals:sptrans:';
const TIMEOUT_MS = 500;

const CoordinatesSchema = z.object({ lat: z.number(), lon: z.number() });
const CachedArrivalsSchema = z.array(
  z.object({
    stopId: z.string(),
    routeId: z.string(),
    routeShortName: z.string(),
    // Entradas gravadas antes das cores existirem continuam válidas, sem cor.
    routeColor: z.string().nullable().default(null),
    routeTextColor: z.string().nullable().default(null),
    directionId: z.union([z.literal(0), z.literal(1)]),
    headsign: z.string().nullable(),
    vehicleId: z.string().nullable(),
    expectedAt: z.string(),
    isRealtime: z.boolean(),
    accessible: z.boolean().nullable(),
    vehicleLocation: CoordinatesSchema.nullable(),
  }),
);

/** Cache curto da previsão por parada: uma chave JSON por parada, com expiração (SET EX). */
@Injectable()
export class RedisArrivalsCache extends ArrivalsCache {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async get(stopId: string): Promise<Arrival[] | null> {
    const raw = await withTimeout(this.redis.get(KEY_PREFIX + stopId), TIMEOUT_MS);
    if (raw === null) return null;
    const parsed = CachedArrivalsSchema.safeParse(safeJson(raw));
    // Entrada corrompida ou de formato antigo conta como ausente.
    return parsed.success ? parsed.data.map((props) => new Arrival(props)) : null;
  }

  async set(stopId: string, arrivals: Arrival[], ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(arrivals.map((arrival) => ({ ...arrival })));
    await withTimeout(this.redis.set(KEY_PREFIX + stopId, payload, 'EX', ttlSeconds), TIMEOUT_MS);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
