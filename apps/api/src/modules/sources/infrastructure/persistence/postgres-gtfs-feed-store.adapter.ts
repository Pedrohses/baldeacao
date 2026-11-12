import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { GtfsFeed, GtfsImportCounts } from '../../domain/entities/gtfs-feed.entity';
import { GtfsFeedStore } from '../../domain/ports/gtfs-feed-store.port';
import {
  type BatchInsert,
  calendarInsert,
  frequenciesInsert,
  routesInsert,
  shapesInsert,
  stopsInsert,
  stopTimesInsert,
  tripsInsert,
} from './gtfs-batch-inserts';

const BATCH_SIZE = 5_000;

// Ordem de remoção respeita as chaves estrangeiras (filhas antes das mães).
const TABLES_TO_CLEAR = [
  'stop_times',
  'frequencies',
  'trips',
  'shapes',
  'stops',
  'routes',
  'calendar',
] as const;

/**
 * Grava o feed com INSERT ... SELECT FROM unnest(...): um parâmetro por coluna e
 * BATCH_SIZE linhas por comando, tudo numa transação. Nunca save() linha a linha.
 */
@Injectable()
export class PostgresGtfsFeedStore extends GtfsFeedStore {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  replace(sourceId: string, feed: GtfsFeed): Promise<GtfsImportCounts> {
    return this.dataSource.transaction(async (manager) => {
      for (const table of TABLES_TO_CLEAR) {
        await manager.query(`DELETE FROM "${table}" WHERE source_id = $1`, [sourceId]);
      }
      const write = <T>(rows: AsyncIterable<T>, insert: BatchInsert<T>) =>
        insertInBatches(manager, sourceId, rows, insert);

      const calendar = await write(feed.calendar(), calendarInsert);
      const routes = await write(feed.routes(), routesInsert);
      const stops = await write(feed.stops(), stopsInsert);
      const shapes = await write(feed.shapes(), shapesInsert);
      const trips = await write(feed.trips(), tripsInsert);
      const stopTimes = await write(feed.stopTimes(), stopTimesInsert);
      const frequencies = await write(feed.frequencies(), frequenciesInsert);
      return { routes, stops, trips, stopTimes, calendar, frequencies, shapes };
    });
  }
}

async function insertInBatches<T>(
  manager: EntityManager,
  sourceId: string,
  rows: AsyncIterable<T>,
  insert: BatchInsert<T>,
): Promise<number> {
  let batch: T[] = [];
  let total = 0;
  const flush = async () => {
    if (batch.length === 0) return;
    await manager.query(insert.sql, [sourceId, ...insert.columns(batch)]);
    total += batch.length;
    batch = [];
  };
  for await (const row of rows) {
    batch.push(row);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  return total;
}
