import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config';
import { REDIS_CLIENT } from '../../shared/infrastructure/redis/redis.module';
import { ImportGtfsFeedUseCase } from './application/use-cases/import-gtfs-feed.use-case';
import { RefreshGtfsFeedUseCase } from './application/use-cases/refresh-gtfs-feed.use-case';
import { SourcesModule } from './sources.module';

// No app DataSource, Redis e config vêm de módulos globais; aqui falsos bastam para ligar as portas.
@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: {} },
    { provide: REDIS_CLIENT, useValue: {} },
    { provide: AppConfig, useValue: {} },
  ],
  exports: [DataSource, REDIS_CLIENT, AppConfig],
})
class FakeInfrastructureModule {}

describe('SourcesModule', () => {
  it('liga as portas e exporta os casos de uso de importação e atualização', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FakeInfrastructureModule,
        // Conexão preguiçosa: não abre Redis no teste (no app vem do RealtimeModule).
        BullModule.forRoot({ connection: { host: '127.0.0.1', port: 1, lazyConnect: true } }),
        SourcesModule,
      ],
    }).compile();

    expect(moduleRef.get(ImportGtfsFeedUseCase)).toBeInstanceOf(ImportGtfsFeedUseCase);
    expect(moduleRef.get(RefreshGtfsFeedUseCase)).toBeInstanceOf(RefreshGtfsFeedUseCase);
    await moduleRef.close();
  });
});
