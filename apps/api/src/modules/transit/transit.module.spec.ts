import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { FindNearbyStopsUseCase } from './application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from './application/use-cases/get-line-details.use-case';
import { SearchLinesUseCase } from './application/use-cases/search-lines.use-case';
import { TransitModule } from './transit.module';

// No app o DataSource vem do DatabaseModule (global); aqui um falso basta para ligar as portas.
@Global()
@Module({
  providers: [{ provide: DataSource, useValue: { getRepository: () => ({}) } }],
  exports: [DataSource],
})
class FakeInfraModule {}

describe('TransitModule', () => {
  it('liga as portas e exporta os casos de uso', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfraModule, TransitModule],
    }).compile();

    for (const useCase of [SearchLinesUseCase, GetLineDetailsUseCase, FindNearbyStopsUseCase]) {
      expect(moduleRef.get(useCase)).toBeInstanceOf(useCase);
    }
    await moduleRef.close();
  });
});
