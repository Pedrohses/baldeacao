import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config';
import { REDIS_CLIENT } from '../../shared/infrastructure/redis/redis.module';
import { FindNearbyStopsUseCase } from './application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from './application/use-cases/get-line-details.use-case';
import { GetStopArrivalsUseCase } from './application/use-cases/get-stop-arrivals.use-case';
import { SearchLinesUseCase } from './application/use-cases/search-lines.use-case';
import { TransitModule } from './transit.module';

// No app DataSource, Redis e AppConfig vêm de módulos globais; aqui falsos bastam para ligar as portas.
@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: { getRepository: () => ({}) } },
    { provide: REDIS_CLIENT, useValue: {} },
    { provide: AppConfig, useValue: { olhoVivoToken: undefined, olhoVivoUserAgent: 'test' } },
  ],
  exports: [DataSource, REDIS_CLIENT, AppConfig],
})
class FakeInfraModule {}

describe('TransitModule', () => {
  it('liga as portas e exporta os casos de uso', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfraModule, TransitModule],
    }).compile();

    for (const useCase of [
      SearchLinesUseCase,
      GetLineDetailsUseCase,
      FindNearbyStopsUseCase,
      GetStopArrivalsUseCase,
    ]) {
      expect(moduleRef.get(useCase)).toBeInstanceOf(useCase);
    }
    await moduleRef.close();
  });
});
