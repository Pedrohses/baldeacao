import type { GtfsImportCounts } from '../../domain/entities/gtfs-feed.entity';
import type { ShapeRepairAction } from '../../domain/services/repair-shapes';

export interface ImportGtfsFeedInput {
  sourceId: string;
  /** Pasta com os arquivos .txt do GTFS. */
  location: string;
}

export interface ImportGtfsFeedResult {
  sourceId: string;
  counts: GtfsImportCounts;
  skippedShapes: string[];
  /** Reparos aplicados aos traçados antes de gravar. */
  shapeRepairs: ShapeRepairAction[];
  durationMs: number;
}
