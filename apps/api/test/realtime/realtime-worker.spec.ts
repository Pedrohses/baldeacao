import { Logger, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PATHS, VehiclePositionSchema, VehicleSnapshotSchema } from '@baldeacao/types';
import Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { RealtimeModule } from '../../src/modules/realtime/realtime.module';
import { mapOlhoVivoPositions } from '../../src/modules/realtime/infrastructure/adapters/olho-vivo-position.mapper';
import { RedisPositionsCycleNotifierAdapter } from '../../src/modules/realtime/infrastructure/adapters/redis-positions-cycle-notifier.adapter';
import { RedisVehiclePositionsStoreAdapter } from '../../src/modules/realtime/infrastructure/adapters/redis-vehicle-positions-store.adapter';
import { RedisModule } from '../../src/shared/infrastructure/redis/redis.module';
import { OlhoVivoClient } from '../../src/shared/infrastructure/olho-vivo/olho-vivo.client';
import { fakeOlhoVivoClient, testConfigModule } from './fake-olho-vivo';
import { rawPositionsFixture } from './in-memory-realtime';

jest.setTimeout(120_000);

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs = 15_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await probe();
    if (value !== null) return value;
    if (Date.now() > deadline) throw new Error('Tempo esgotado esperando o Redis.');
    await new Promise((r) => setTimeout(r, 100));
  }
}

describe('tempo real no Redis (Testcontainers)', () => {
  let container: StartedTestContainer;
  let redisUrl: string;
  let redis: Redis;

  beforeAll(async () => {
    container = await new GenericContainer('redis:8.8').withExposedPorts(6379).start();
    redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    redis = new Redis(redisUrl);
  });

  afterAll(async () => {
    await redis?.quit();
    await container?.stop();
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  describe('RedisVehiclePositionsStoreAdapter', () => {
    const vehicles = mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans');

    it('grava GEO, detalhes e updated_at e lê de volta no contrato', async () => {
      const store = new RedisVehiclePositionsStoreAdapter(redis);

      await store.replace('sptrans', vehicles, '2026-11-12T15:34:30.000Z');

      expect(await redis.zcard('vehicles:sptrans')).toBe(4);
      expect(await redis.get('realtime:sptrans:updated_at')).toBe('2026-11-12T15:34:30.000Z');
      expect(await redis.ttl('vehicle:sptrans:11433')).toBeGreaterThan(0);
      const read = await store.read('sptrans');
      expect(read.updatedAt).toBe('2026-11-12T15:34:30.000Z');
      const byId = new Map(read.vehicles.map((v) => [v.vehicleId, v]));
      for (const expected of vehicles) {
        const got = byId.get(expected.vehicleId);
        expect(got && VehiclePositionSchema.parse(got)).toMatchObject({
          ...expected,
          location: {
            lat: expect.closeTo(expected.location.lat, 5) as number,
            lon: expect.closeTo(expected.location.lon, 5) as number,
          },
        });
      }
    });

    it('cada ciclo substitui a foto: veículo que sumiu da fonte sai do GEO', async () => {
      const store = new RedisVehiclePositionsStoreAdapter(redis);
      await store.replace('sptrans', vehicles, '2026-11-12T15:34:30.000Z');

      await store.replace('sptrans', vehicles.slice(0, 1), '2026-11-12T15:35:00.000Z');
      expect((await store.read('sptrans')).vehicles).toHaveLength(1);

      await store.replace('sptrans', [], '2026-11-12T15:35:30.000Z');
      expect(await store.read('sptrans')).toEqual({
        updatedAt: '2026-11-12T15:35:30.000Z',
        vehicles: [],
      });
    });

    it('fonte que nunca rodou devolve updatedAt null', async () => {
      const store = new RedisVehiclePositionsStoreAdapter(redis);
      expect(await store.read('sptrans')).toEqual({ updatedAt: null, vehicles: [] });
    });
  });

  describe('RedisPositionsCycleNotifierAdapter', () => {
    it('entrega o evento do ciclo pelo pub/sub positions:{source}', async () => {
      const publisher = new RedisPositionsCycleNotifierAdapter(redis);
      const subscriber = new RedisPositionsCycleNotifierAdapter(redis);
      const received = new Promise((resolve) => void subscriber.subscribe(resolve));
      await new Promise((r) => setTimeout(r, 200));

      const event = { sourceId: 'sptrans', updatedAt: '2026-11-12T15:34:30.000Z', vehicleCount: 4 };
      await publisher.publish(event);

      await expect(received).resolves.toEqual(event);
      await subscriber.onModuleDestroy();
    });
  });

  describe('worker BullMQ do RealtimeModule', () => {
    let app: INestApplication | undefined;

    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    });

    afterEach(async () => {
      await app?.close();
      app = undefined;
      jest.restoreAllMocks();
    });

    async function boot(client: OlhoVivoClient): Promise<INestApplication> {
      const moduleRef = await Test.createTestingModule({
        imports: [testConfigModule(redisUrl), RedisModule, RealtimeModule],
      })
        .overrideProvider(OlhoVivoClient)
        .useValue(client)
        .compile();
      app = moduleRef.createNestApplication({ logger: false });
      await app.init();
      return app;
    }

    it('roda o ciclo agendado e preenche o Redis com a fixture', async () => {
      await boot(fakeOlhoVivoClient());

      const updatedAt = await waitFor(() => redis.get('realtime:sptrans:updated_at'));

      expect(Date.parse(updatedAt)).not.toBeNaN();
      expect(await redis.zcard('vehicles:sptrans')).toBe(4);
      expect(JSON.parse((await redis.get('vehicle:sptrans:11611')) ?? '{}')).toMatchObject({
        routeId: '875A-10',
        directionId: 1,
      });
    });

    it('GET /vehicles/positions lê a foto gravada pelo worker', async () => {
      const running = await boot(fakeOlhoVivoClient());
      const updatedAt = await waitFor(() => redis.get('realtime:sptrans:updated_at'));

      const response = await request(running.getHttpServer() as App)
        .get(API_PATHS.vehiclePositions)
        .query({ routeId: '875A-10' })
        .expect(200);

      const snapshot = VehicleSnapshotSchema.parse(response.body);
      expect(snapshot).toMatchObject({ sourceId: 'sptrans', routeId: '875A-10', updatedAt });
      expect(snapshot.vehicles.map((v) => v.vehicleId).sort()).toEqual(['11433', '11502', '11611']);
    });

    it('token recusado vira log e o app continua de pé', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      await boot(fakeOlhoVivoClient({ refuseLogin: true }));

      await waitFor(() => Promise.resolve(error.mock.calls.length > 0 ? true : null));

      expect(error).toHaveBeenCalledWith(expect.stringContaining('OLHO_VIVO_AUTH_FAILED'));
      expect(await redis.get('realtime:sptrans:updated_at')).toBeNull();
      expect(app).toBeDefined();
    });
  });
});
