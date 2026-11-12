import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LineShapeSchema, RouteSchema, StopSchema } from '@baldeacao/types';
import {
  GTFS_MINI_DIR,
  POSTGIS_TEST_TIMEOUT_MS,
  startPostgis,
  type PostgisTestDatabase,
} from '../../../../../test/support/postgis-container';
import { haversineM } from '../../../../../test/support/transit-in-memory';
// Só para semear o banco: o teste usa o importador real do contexto sources.
import { ImportGtfsFeedUseCase } from '../../../sources/application/use-cases/import-gtfs-feed.use-case';
import { CsvGtfsFeedReader } from '../../../sources/infrastructure/adapters/csv-gtfs-feed-reader.adapter';
import { PostgresGtfsFeedStore } from '../../../sources/infrastructure/persistence/postgres-gtfs-feed-store.adapter';
import { TypeormRouteRepository } from './typeorm-route.repository';
import { TypeormStopRepository } from './typeorm-stop.repository';

jest.setTimeout(POSTGIS_TEST_TIMEOUT_MS);

function fixtureStops(): Array<{ id: string; lat: number; lon: number }> {
  const [, ...lines] = readFileSync(join(GTFS_MINI_DIR, 'stops.txt'), 'utf8').trim().split('\n');
  return lines.map((line) => {
    const [id = '', , , lat = '', lon = ''] = line.split(',');
    return { id, lat: Number(lat), lon: Number(lon) };
  });
}

describe('repositórios do transit (Testcontainers + PostGIS)', () => {
  let db: PostgisTestDatabase;
  let routes: TypeormRouteRepository;
  let stops: TypeormStopRepository;

  beforeAll(async () => {
    db = await startPostgis();
    await new ImportGtfsFeedUseCase(
      new CsvGtfsFeedReader(),
      new PostgresGtfsFeedStore(db.dataSource),
    ).execute({ sourceId: 'sptrans', location: GTFS_MINI_DIR });
    routes = new TypeormRouteRepository(db.dataSource);
    stops = new TypeormStopRepository(db.dataSource);
  });
  afterAll(() => db?.stop());

  describe('TypeormRouteRepository', () => {
    it('busca por letreiro sem diferenciar maiúsculas', async () => {
      const found = await routes.search('875a', 20);
      expect(found.map((r) => r.id)).toEqual(['875A-10']);
      expect(RouteSchema.parse({ ...found[0] })).toEqual({
        id: '875A-10',
        sourceId: 'sptrans',
        shortName: '875A-10',
        longName: 'Perdizes - Aeroporto',
        type: 'bus',
        color: '509E2F',
        textColor: 'FFFFFF',
      });
    });

    it('busca pelo nome e põe letreiro com prefixo antes de nome que contém', async () => {
      const byName = await routes.search('pedro ii', 20);
      expect(byName.map((r) => r.id).sort()).toEqual(['477U-10', '8000-10']);

      const mixed = await routes.search('10', 20);
      expect(mixed).toHaveLength(3);
      expect(await routes.search('aero', 1)).toHaveLength(1);
    });

    it('trata % e _ como texto, não como curinga', async () => {
      expect(await routes.search('%%', 20)).toEqual([]);
      expect(await routes.search('__', 20)).toEqual([]);
    });

    it('acha a linha por id e devolve null para id desconhecido', async () => {
      expect((await routes.findById('8000-10'))?.longName).toBe(
        'Term. Pq. D. Pedro II - Jd. Angela',
      );
      expect(await routes.findById('9999-10')).toBeNull();
    });

    it('devolve um traçado por sentido, em ordem, com os pontos do shapes.txt', async () => {
      const line = await routes.findById('875A-10');
      const shapes = await routes.findShapes(line!);

      expect(shapes.map((s) => [s.directionId, s.shapeId])).toEqual([
        [0, '84609'],
        [1, '84610'],
      ]);
      for (const shape of shapes) LineShapeSchema.parse({ ...shape });
      expect(shapes[0]?.points[0]).toEqual({ lat: -23.535, lon: -46.675 });
      expect(shapes[0]?.points).toHaveLength(8);
    });
  });

  describe('TypeormStopRepository (ST_DWithin)', () => {
    const paulista = { lat: -23.5614, lon: -46.6559 };

    it('acha a parada no próprio ponto com distância zero', async () => {
      const found = await stops.findNearby(paulista, 50, 10);
      expect(found).toHaveLength(1);
      expect(found[0]?.distanceM).toBe(0);
      expect(
        StopSchema.parse({ ...found[0]!.stop, location: { ...found[0]!.stop.location } }),
      ).toEqual({
        id: '4301848',
        sourceId: 'sptrans',
        code: null,
        name: 'Av. Paulista 1578',
        description: 'Em frente ao MASP',
        location: paulista,
      });
    });

    it.each([500, 2000, 5000])(
      'raio de %p m devolve as mesmas paradas da conta esférica',
      async (radius) => {
        const found = await stops.findNearby(paulista, radius, 100);
        const expected = fixtureStops()
          .map((s) => ({ id: s.id, d: haversineM(paulista, s) }))
          .filter((s) => s.d <= radius)
          .sort((a, b) => a.d - b.d);

        expect(found.map((s) => s.stop.id)).toEqual(expected.map((s) => s.id));
        found.forEach((s, i) => {
          // geography mede no esferoide; a conta esférica difere em menos de 0,5%.
          expect(Math.abs(s.distanceM - expected[i]!.d)).toBeLessThanOrEqual(
            expected[i]!.d * 0.005 + 1,
          );
        });
      },
    );

    it('respeita o limite', async () => {
      expect(await stops.findNearby(paulista, 50_000, 3)).toHaveLength(3);
    });
  });

  describe('TypeormStopRepository.searchByName (pg_trgm + unaccent)', () => {
    beforeAll(async () => {
      const q = (sql: string) => db.dataSource.query(sql);
      await q(`INSERT INTO stops (source_id, stop_id, name, description, location) VALUES
        ('sptrans', 'M1', 'Luz', NULL, ST_GeogFromText('POINT(-46.6336 -23.5361)')),
        ('sptrans', 'T1', 'Luz', NULL, ST_GeogFromText('POINT(-46.6337 -23.5362)')),
        ('sptrans', 'M2', 'Sé', NULL, ST_GeogFromText('POINT(-46.6339 -23.5503)')),
        ('sptrans', 'B1', 'Pça. da Luz', 'Ref.: R. Prates', ST_GeogFromText('POINT(-46.634 -23.536)')),
        ('sptrans', 'B2', 'R. Luzia da Conceição Moraes, 450', NULL, ST_GeogFromText('POINT(-46.7 -23.6)'))`);
      await q(`INSERT INTO routes (source_id, route_id, short_name, long_name, route_type) VALUES
        ('sptrans', 'L1', 'Azul', 'Linha 1', 1), ('sptrans', 'L7', 'Rubi', 'Linha 7', 2)`);
      await q(`INSERT INTO trips (source_id, trip_id, route_id, service_id) VALUES
        ('sptrans', 'L1-0', 'L1', 'U'), ('sptrans', 'L7-0', 'L7', 'U')`);
      await q(`INSERT INTO stop_times (source_id, trip_id, stop_sequence, stop_id) VALUES
        ('sptrans', 'L1-0', 1, 'M1'), ('sptrans', 'L1-0', 2, 'M2'), ('sptrans', 'L7-0', 1, 'T1')`);
    });

    it('acha por trecho do nome sem diferenciar acento nem caixa', async () => {
      const found = await stops.searchByName('PAULISTA', 8);
      expect(found.map((s) => s.id)).toEqual(['4301848']);
      expect((await stops.searchByName('se', 8))[0]?.name).toBe('Sé');
      expect((await stops.searchByName('conceicao', 8)).map((s) => s.id)).toEqual(['B2']);
    });

    it('estações primeiro, uma por nome, depois nomes mais curtos', async () => {
      const found = await stops.searchByName('luz', 8);
      expect(found.map((s) => s.id)).toEqual(['M1', 'B1', 'B2']);
    });

    it('tolera erro de digitação e respeita o limite', async () => {
      expect((await stops.searchByName('paulistta', 8)).map((s) => s.id)).toContain('4301848');
      expect(await stops.searchByName('av', 2)).toHaveLength(2);
    });

    it('trata % e _ como texto', async () => {
      expect(await stops.searchByName('%%', 8)).toEqual([]);
    });
  });
});
