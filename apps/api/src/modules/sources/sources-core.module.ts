import { Module } from '@nestjs/common';
import { ImportGtfsFeedUseCase } from './application/use-cases/import-gtfs-feed.use-case';
import { RefreshGtfsFeedUseCase } from './application/use-cases/refresh-gtfs-feed.use-case';
import { GtfsArchiveDownloader } from './domain/ports/gtfs-archive-downloader.port';
import { GtfsFeedReader } from './domain/ports/gtfs-feed-reader.port';
import { GtfsFeedStore } from './domain/ports/gtfs-feed-store.port';
import { GtfsImportStateStore } from './domain/ports/gtfs-import-state-store.port';
import { CsvGtfsFeedReader } from './infrastructure/adapters/csv-gtfs-feed-reader.adapter';
import { FetchGtfsArchiveDownloader } from './infrastructure/adapters/fetch-gtfs-archive-downloader.adapter';
import { RedisGtfsImportStateStore } from './infrastructure/adapters/redis-gtfs-import-state-store.adapter';
import { PostgresGtfsFeedStore } from './infrastructure/persistence/postgres-gtfs-feed-store.adapter';

/** Casos de uso e portas, sem filas: o CLI usa só isto, sem abrir conexões do BullMQ. */
@Module({
  providers: [
    ImportGtfsFeedUseCase,
    RefreshGtfsFeedUseCase,
    { provide: GtfsFeedReader, useClass: CsvGtfsFeedReader },
    { provide: GtfsFeedStore, useClass: PostgresGtfsFeedStore },
    { provide: GtfsArchiveDownloader, useClass: FetchGtfsArchiveDownloader },
    { provide: GtfsImportStateStore, useClass: RedisGtfsImportStateStore },
  ],
  exports: [ImportGtfsFeedUseCase, RefreshGtfsFeedUseCase],
})
export class SourcesCoreModule {}
