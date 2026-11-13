import { Injectable } from '@nestjs/common';
import type { GtfsFeed, GtfsShape } from '../../domain/entities/gtfs-feed.entity';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import { GtfsFeedReader } from '../../domain/ports/gtfs-feed-reader.port';
import { GtfsFeedStore } from '../../domain/ports/gtfs-feed-store.port';
import type { ImportGtfsFeedInput, ImportGtfsFeedResult } from '../dto/import-gtfs-feed.dto';
import { RepairGtfsShapesUseCase } from './repair-gtfs-shapes.use-case';

const SOURCE_ID = /^[a-z0-9-]+$/;

@Injectable()
export class ImportGtfsFeedUseCase {
  constructor(
    private readonly reader: GtfsFeedReader,
    private readonly store: GtfsFeedStore,
    private readonly repair: RepairGtfsShapesUseCase = new RepairGtfsShapesUseCase(),
  ) {}

  async execute(input: ImportGtfsFeedInput): Promise<ImportGtfsFeedResult> {
    if (!SOURCE_ID.test(input.sourceId)) {
      throw new InvalidGtfsFeedError(
        `Fonte inválida: "${input.sourceId}". Use minúsculas, dígitos e hífen.`,
      );
    }
    const startedAt = Date.now();
    const raw = await this.reader.open(input.location);

    // shapes.txt vem ponto a ponto; o LineString precisa do traçado inteiro, ordenado
    // e com os mesmos reparos que o zip do OTP recebe (gtfs:prepare).
    const { shapes, skipped, actions } = await this.repair.execute(raw);
    const feed: GtfsFeed = {
      routes: () => raw.routes(),
      stops: () => raw.stops(),
      trips: () => raw.trips(),
      stopTimes: () => raw.stopTimes(),
      calendar: () => raw.calendar(),
      frequencies: () => raw.frequencies(),
      shapes: () => fromArray(shapes),
    };

    const counts = await this.store.replace(input.sourceId, feed);
    return {
      sourceId: input.sourceId,
      counts,
      skippedShapes: skipped,
      shapeRepairs: actions,
      durationMs: Date.now() - startedAt,
    };
  }
}

async function* fromArray(items: GtfsShape[]): AsyncIterable<GtfsShape> {
  for (const item of items) yield await Promise.resolve(item);
}
