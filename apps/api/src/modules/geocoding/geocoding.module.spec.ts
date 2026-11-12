import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config';
import { SearchPlacesUseCase } from './application/use-cases/search-places.use-case';
import { GeocodingModule } from './geocoding.module';

// No app DataSource e AppConfig vêm de módulos globais; aqui falsos bastam para ligar as portas.
@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: {} },
    {
      provide: AppConfig,
      useValue: { nominatimUrl: 'https://nominatim.test', nominatimUserAgent: 'test' },
    },
  ],
  exports: [DataSource, AppConfig],
})
class FakeInfraModule {}

@Module({ imports: [GeocodingModule] })
class ConsumerModule {}

describe('GeocodingModule', () => {
  it('liga as portas e exporta SearchPlacesUseCase', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfraModule, ConsumerModule],
    }).compile();
    expect(moduleRef.select(ConsumerModule).get(SearchPlacesUseCase)).toBeInstanceOf(
      SearchPlacesUseCase,
    );
    await moduleRef.close();
  });
});
