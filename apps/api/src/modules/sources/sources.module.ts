import { Module } from '@nestjs/common';
import { ImportGtfsFeedUseCase } from './application/use-cases/import-gtfs-feed.use-case';
import { GtfsFeedReader } from './domain/ports/gtfs-feed-reader.port';
import { GtfsFeedStore } from './domain/ports/gtfs-feed-store.port';
import { CsvGtfsFeedReader } from './infrastructure/adapters/csv-gtfs-feed-reader.adapter';
import { PostgresGtfsFeedStore } from './infrastructure/persistence/postgres-gtfs-feed-store.adapter';

@Module({
  providers: [
    ImportGtfsFeedUseCase,
    { provide: GtfsFeedReader, useClass: CsvGtfsFeedReader },
    { provide: GtfsFeedStore, useClass: PostgresGtfsFeedStore },
  ],
  exports: [ImportGtfsFeedUseCase],
})
export class SourcesModule {}
