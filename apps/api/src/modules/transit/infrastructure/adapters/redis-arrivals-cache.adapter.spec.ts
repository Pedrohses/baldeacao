import Redis from 'ioredis';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Arrival } from '../../domain/entities/arrival.entity';
import { RedisArrivalsCache } from './redis-arrivals-cache.adapter';

jest.setTimeout(120_000);

const arrival = new Arrival({
  stopId: '4301848',
  routeId: '875A-10',
  routeShortName: '875A-10',
  directionId: 0,
  headsign: 'AEROPORTO',
  vehicleId: '11433',
  expectedAt: '2026-11-12T12:36:00-03:00',
  isRealtime: true,
  accessible: true,
  vehicleLocation: { lat: -23.559, lon: -46.6612 },
});

describe('RedisArrivalsCache (Testcontainers)', () => {
  let container: StartedTestContainer;
  let redis: Redis;
  let cache: RedisArrivalsCache;

  beforeAll(async () => {
    // Mesma imagem do infra/docker-compose.yml.
    container = await new GenericContainer('redis:8.8').withExposedPorts(6379).start();
    redis = new Redis(container.getMappedPort(6379), container.getHost());
    cache = new RedisArrivalsCache(redis);
  });
  afterAll(async () => {
    await redis?.quit();
    await container?.stop();
  });

  it('guarda e devolve as previsões com expiração', async () => {
    await cache.set('4301848', [arrival], 20);

    const cached = await cache.get('4301848');
    expect(cached).toEqual([arrival]);
    expect(cached?.[0]).toBeInstanceOf(Arrival);
    const ttl = await redis.ttl('arrivals:sptrans:4301848');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(20);
  });

  it('guarda lista vazia (parada sem ônibus a caminho também é resposta)', async () => {
    await cache.set('4200953', [], 20);
    await expect(cache.get('4200953')).resolves.toEqual([]);
  });

  it('trata ausência e entrada corrompida como cache vazio', async () => {
    await expect(cache.get('999')).resolves.toBeNull();
    await redis.set('arrivals:sptrans:888', '{quebrado', 'EX', 20);
    await expect(cache.get('888')).resolves.toBeNull();
  });
});
