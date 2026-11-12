import type Redis from 'ioredis';
import type { DataSource } from 'typeorm';
import { PostgresHealthAdapter } from './postgres-health.adapter';
import { RedisHealthAdapter } from './redis-health.adapter';

const never = <T>(): Promise<T> => new Promise<T>(() => undefined);

describe('health adapters (timeout compartilhado)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Redis: PONG significa up', async () => {
    const redis = { ping: jest.fn().mockResolvedValue('PONG') } as unknown as Redis;
    await expect(new RedisHealthAdapter(redis).isUp()).resolves.toBe(true);
  });

  it('Redis: estoura o timeout quando o ping não responde', async () => {
    const redis = { ping: jest.fn(() => never<string>()) } as unknown as Redis;
    const assertion = expect(new RedisHealthAdapter(redis).isUp()).rejects.toThrow(
      'Tempo esgotado',
    );
    await jest.advanceTimersByTimeAsync(2_000);
    await assertion;
  });

  it('Postgres: false quando o DataSource não foi inicializado', async () => {
    const ds = { isInitialized: false } as unknown as DataSource;
    await expect(new PostgresHealthAdapter(ds).isUp()).resolves.toBe(false);
  });

  it('Postgres: estoura o timeout quando a query trava', async () => {
    const ds = { isInitialized: true, query: jest.fn(() => never()) } as unknown as DataSource;
    const assertion = expect(new PostgresHealthAdapter(ds).isUp()).rejects.toThrow(
      'Tempo esgotado',
    );
    await jest.advanceTimersByTimeAsync(2_000);
    await assertion;
  });
});
