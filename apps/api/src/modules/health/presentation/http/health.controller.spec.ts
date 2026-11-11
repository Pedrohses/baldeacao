import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CheckHealthUseCase } from '../../application/use-cases/check-health.use-case';
import { CacheHealthPort } from '../../domain/ports/cache-health.port';
import { DatabaseHealthPort } from '../../domain/ports/database-health.port';
import { HealthController } from './health.controller';

async function createApp(cacheUp: boolean): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      CheckHealthUseCase,
      { provide: DatabaseHealthPort, useValue: { isUp: () => Promise.resolve(true) } },
      { provide: CacheHealthPort, useValue: { isUp: () => Promise.resolve(cacheUp) } },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}

describe('GET /health', () => {
  let app: INestApplication<App> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('responde 200 com status ok', async () => {
    app = await createApp(true);

    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', checks: { postgres: 'up', redis: 'up' } });
  });

  it('responde 503 quando uma dependência está fora', async () => {
    app = await createApp(false);

    await request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect({ status: 'error', checks: { postgres: 'up', redis: 'down' } });
  });
});
