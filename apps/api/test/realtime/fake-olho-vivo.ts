import { Global, Module } from '@nestjs/common';
import { AppConfig } from '../../src/config/app-config';
import { envSchema } from '../../src/config/env';
import { OlhoVivoClient } from '../../src/shared/infrastructure/olho-vivo/olho-vivo.client';
import { readOlhoVivoFixture } from './in-memory-realtime';

/** fetch falso da Olho Vivo: login aceito (ou recusado) e /Posicao servindo posicao.json. */
export function fakeOlhoVivoFetch(options: { refuseLogin?: boolean } = {}): typeof fetch {
  return (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    if (url.includes('Login/Autenticar')) {
      return Promise.resolve(
        options.refuseLogin
          ? new Response(readOlhoVivoFixture('login-recusado'), { status: 200 })
          : new Response(readOlhoVivoFixture('login-ok'), {
              status: 200,
              headers: { 'Set-Cookie': 'apiCredentials=fake; path=/; HttpOnly' },
            }),
      );
    }
    if (url.includes('Posicao')) {
      return Promise.resolve(new Response(readOlhoVivoFixture('posicao'), { status: 200 }));
    }
    return Promise.resolve(new Response('not found', { status: 404 }));
  };
}

export function fakeOlhoVivoClient(options: { refuseLogin?: boolean } = {}): OlhoVivoClient {
  return new OlhoVivoClient({
    token: 'fake-token',
    userAgent: 'baldeacao/test',
    fetch: fakeOlhoVivoFetch(options),
    sleep: () => Promise.resolve(),
  });
}

/** AppConfig de teste sem ler .env, apontando para o Redis informado. */
export function testConfigModule(redisUrl: string) {
  const config = new AppConfig(
    envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://unused:unused@localhost:5432/unused',
      REDIS_URL: redisUrl,
    }),
  );

  @Global()
  @Module({ providers: [{ provide: AppConfig, useValue: config }], exports: [AppConfig] })
  class TestConfigModule {}

  return TestConfigModule;
}
