import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ImportGtfsFeedUseCase } from './application/use-cases/import-gtfs-feed.use-case';
import { SourcesModule } from './sources.module';

// No app o DataSource vem do DatabaseModule (global); aqui um falso basta para ligar as portas.
@Global()
@Module({ providers: [{ provide: DataSource, useValue: {} }], exports: [DataSource] })
class FakeDatabaseModule {}

describe('SourcesModule', () => {
  it('liga as portas e exporta o caso de uso de importação', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeDatabaseModule, SourcesModule],
    }).compile();

    expect(moduleRef.get(ImportGtfsFeedUseCase)).toBeInstanceOf(ImportGtfsFeedUseCase);
    await moduleRef.close();
  });
});
