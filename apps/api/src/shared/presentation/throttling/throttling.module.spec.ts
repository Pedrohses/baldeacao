import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, Global, type INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppConfig } from '../../../config/app-config';
import { envSchema } from '../../../config/env';
import { HeavyRoute } from './heavy-route.decorator';
import { THROTTLES } from './throttles';
import { ThrottlingModule } from './throttling.module';

@Controller()
class FakeController {
  @Get('leve')
  light(): string {
    return 'ok';
  }

  @Post('pesada')
  @HeavyRoute()
  heavy(): string {
    return 'ok';
  }

  @Get('health')
  health(): string {
    return 'ok';
  }
}

@Global()
@Module({
  providers: [
    {
      provide: AppConfig,
      useValue: new AppConfig(
        envSchema.parse({ DATABASE_URL: 'postgres://teste', REDIS_URL: 'redis://teste' }),
      ),
    },
  ],
  exports: [AppConfig],
})
class TestConfigModule {}

describe('ThrottlingModule', () => {
  let app: INestApplication;
  let base: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestConfigModule, ThrottlingModule],
      controllers: [FakeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  const call = (path: string, ip: string, method = 'GET') =>
    fetch(`${base}${path}`, { method, headers: { 'X-Forwarded-For': ip } });

  it(`rota pesada aceita ${THROTTLES.heavy.limit} por minuto por IP e depois responde 429`, async () => {
    for (let i = 0; i < THROTTLES.heavy.limit; i++) {
      const res = await call('/pesada', '203.0.113.7', 'POST');
      expect(res.status).toBe(201);
    }
    const blocked = await call('/pesada', '203.0.113.7', 'POST');
    expect(blocked.status).toBe(429);

    // Outro IP, atrás do mesmo proxy (loopback), tem a sua própria cota.
    expect((await call('/pesada', '198.51.100.2', 'POST')).status).toBe(201);
    // Rota leve continua liberada para o IP que estourou a pesada.
    expect((await call('/leve', '203.0.113.7')).status).toBe(200);
  });

  it('rota leve tem o limite geral, bem mais alto', async () => {
    const results = await Promise.all(
      Array.from({ length: THROTTLES.heavy.limit + 5 }, () => call('/leve', '203.0.113.9')),
    );
    expect(results.every((res) => res.status === 200)).toBe(true);
  });

  it('/health fica fora de qualquer limite', async () => {
    const results = await Promise.all(
      Array.from({ length: THROTTLES.api.limit + 1 }, () => call('/health', '203.0.113.10')),
    );
    expect(results.every((res) => res.status === 200)).toBe(true);
  });
});
