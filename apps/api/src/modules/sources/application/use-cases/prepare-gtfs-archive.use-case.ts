import { Injectable } from '@nestjs/common';
import type { GtfsFrequency } from '../../domain/entities/gtfs-feed.entity';
import { GtfsArchiveFiles } from '../../domain/ports/gtfs-archive-files.port';
import { GtfsFeedReader } from '../../domain/ports/gtfs-feed-reader.port';
import type { ShapeRepairAction } from '../../domain/services/repair-shapes';
import { RepairGtfsShapesUseCase } from './repair-gtfs-shapes.use-case';

export interface PrepareGtfsArchiveInput {
  /** Zip GTFS ou pasta com os .txt. */
  input: string;
  /** Caminho do zip reparado. */
  output: string;
}

export interface PrepareGtfsArchiveResult {
  output: string;
  bytes: number;
  shapes: number;
  skippedShapes: string[];
  exactFrequencies: number;
  shapeRepairs: ShapeRepairAction[];
}

/**
 * Gera o zip GTFS que o OTP consome: traçados reparados (os mesmos da importação no
 * Postgres) e frequências marcadas como exatas (exact_times=1). Sem exact_times o OTP
 * trata cada faixa como "passa a cada N minutos" e soma o intervalo inteiro como espera.
 */
@Injectable()
export class PrepareGtfsArchiveUseCase {
  constructor(
    private readonly reader: GtfsFeedReader,
    private readonly files: GtfsArchiveFiles,
    private readonly repair: RepairGtfsShapesUseCase,
  ) {}

  async execute(input: PrepareGtfsArchiveInput): Promise<PrepareGtfsArchiveResult> {
    const unpacked = await this.files.unpack(input.input);
    try {
      const raw = await this.reader.open(unpacked.dir);
      const repaired = await this.repair.execute(raw);
      const frequencies: Array<GtfsFrequency & { exactTimes: boolean }> = [];
      for await (const frequency of raw.frequencies()) {
        frequencies.push({ ...frequency, exactTimes: true });
      }
      const bytes = await this.files.pack(unpacked.dir, input.output, {
        shapes: repaired.shapes,
        frequencies,
      });
      return {
        output: input.output,
        bytes,
        shapes: repaired.shapes.length,
        skippedShapes: repaired.skipped,
        exactFrequencies: frequencies.length,
        shapeRepairs: repaired.actions,
      };
    } finally {
      await unpacked.release();
    }
  }
}
