import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GTFS_MINI_DIR,
  POSTGIS_TEST_TIMEOUT_MS,
  startPostgis,
  type PostgisTestDatabase,
} from '../../../../../test/support/postgis-container';
import { ImportGtfsFeedUseCase } from '../../application/use-cases/import-gtfs-feed.use-case';
import { CsvGtfsFeedReader } from '../adapters/csv-gtfs-feed-reader.adapter';
import { PostgresGtfsFeedStore } from './postgres-gtfs-feed-store.adapter';

jest.setTimeout(POSTGIS_TEST_TIMEOUT_MS);

describe('PostgresGtfsFeedStore (Testcontainers)', () => {
  let db: PostgisTestDatabase;
  let importer: ImportGtfsFeedUseCase;

  const count = async (table: string): Promise<number> => {
    const [row] = await db.dataSource.query<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM "${table}" WHERE source_id = 'sptrans'`,
    );
    return row?.n ?? 0;
  };

  beforeAll(async () => {
    db = await startPostgis();
    importer = new ImportGtfsFeedUseCase(
      new CsvGtfsFeedReader(),
      new PostgresGtfsFeedStore(db.dataSource),
    );
  });
  afterAll(() => db?.stop());

  it('importa o recorte sptrans-mini com geografia e horários', async () => {
    const result = await importer.execute({ sourceId: 'sptrans', location: GTFS_MINI_DIR });

    expect(result.counts).toEqual({
      routes: 3,
      stops: 13,
      trips: 6,
      stopTimes: 28,
      calendar: 1,
      frequencies: 10,
      shapes: 6,
    });
    const [stop] = await db.dataSource.query<Array<{ lon: number; lat: number }>>(
      `SELECT ST_X(location::geometry) AS lon, ST_Y(location::geometry) AS lat
       FROM stops WHERE stop_id = '4301848'`,
    );
    expect(stop).toEqual({ lon: -46.6559, lat: -23.5614 });

    const [shape] = await db.dataSource.query<Array<{ points: number; start: string }>>(
      `SELECT ST_NPoints(path::geometry) AS points, ST_AsText(ST_StartPoint(path::geometry)) AS start
       FROM shapes WHERE shape_id = '51234'`,
    );
    expect(shape).toEqual({ points: 8, start: 'POINT(-46.6293 -23.5448)' });
  });

  it('reimportar troca o feed em vez de duplicar', async () => {
    await importer.execute({ sourceId: 'sptrans', location: GTFS_MINI_DIR });
    expect(await count('routes')).toBe(3);
    expect(await count('stop_times')).toBe(28);
  });

  it('desfaz tudo quando o feed quebra no meio e mantém o anterior', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gtfs-'));
    try {
      await cp(GTFS_MINI_DIR, dir, { recursive: true });
      // stop_times aponta para uma parada que não existe: a FK falha depois de rotas e paradas.
      await writeFile(
        join(dir, 'stop_times.txt'),
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence\n8000-10-0,00:00:00,00:00:00,999,1\n',
      );
      await expect(importer.execute({ sourceId: 'sptrans', location: dir })).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    expect(await count('routes')).toBe(3);
    expect(await count('stop_times')).toBe(28);
  });
});
