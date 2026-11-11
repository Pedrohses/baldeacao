import { CacheHealthPort } from '../../domain/ports/cache-health.port';
import { DatabaseHealthPort } from '../../domain/ports/database-health.port';
import { CheckHealthUseCase } from './check-health.use-case';

class InMemoryDatabaseHealth extends DatabaseHealthPort {
  constructor(private readonly result: boolean | Error) {
    super();
  }
  isUp(): Promise<boolean> {
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

class InMemoryCacheHealth extends CacheHealthPort {
  constructor(private readonly result: boolean | Error) {
    super();
  }
  isUp(): Promise<boolean> {
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

describe('CheckHealthUseCase', () => {
  it('retorna ok quando Postgres e Redis estão de pé', async () => {
    const useCase = new CheckHealthUseCase(
      new InMemoryDatabaseHealth(true),
      new InMemoryCacheHealth(true),
    );

    await expect(useCase.execute()).resolves.toEqual({
      status: 'ok',
      checks: { postgres: 'up', redis: 'up' },
    });
  });

  it('marca a dependência como down quando a checagem falha ou lança erro', async () => {
    const useCase = new CheckHealthUseCase(
      new InMemoryDatabaseHealth(new Error('connection refused')),
      new InMemoryCacheHealth(false),
    );

    await expect(useCase.execute()).resolves.toEqual({
      status: 'error',
      checks: { postgres: 'down', redis: 'down' },
    });
  });
});
