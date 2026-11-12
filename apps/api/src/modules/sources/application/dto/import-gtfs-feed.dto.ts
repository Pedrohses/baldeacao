import type { GtfsImportCounts } from '../../domain/entities/gtfs-feed.entity';

export interface ImportGtfsFeedInput {
  sourceId: string;
  /** Pasta com os arquivos .txt do GTFS. */
  location: string;
}

export interface ImportGtfsFeedResult {
  sourceId: string;
  counts: GtfsImportCounts;
  skippedShapes: string[];
  durationMs: number;
}
