import {
  POSTGIS_TEST_TIMEOUT_MS,
  startPostgis,
  type PostgisTestDatabase,
} from '../../../../../test/support/postgis-container';
import type { KnownPlaceRecord } from '../../domain/ports/known-place-repository.port';
import { TypeormKnownPlaceRepository } from './typeorm-known-place.repository';

jest.setTimeout(POSTGIS_TEST_TIMEOUT_MS);

function record(
  id: string,
  name: string,
  importance: number,
  geometry: unknown,
  category = 'leisure=park',
): KnownPlaceRecord {
  return {
    id,
    name,
    category,
    importance,
    address: null,
    suburb: null,
    city: 'São Paulo',
    geometryGeoJson: JSON.stringify(geometry),
  };
}

// Quadrado em volta do Ibirapuera: o centroide fica no meio.
const IBIRAPUERA_AREA = {
  type: 'MultiPolygon',
  coordinates: [
    [
      [
        [-46.66, -23.59],
        [-46.65, -23.59],
        [-46.65, -23.58],
        [-46.66, -23.58],
        [-46.66, -23.59],
      ],
    ],
  ],
};

describe('TypeormKnownPlaceRepository (Testcontainers + PostGIS)', () => {
  let db: PostgisTestDatabase;
  let places: TypeormKnownPlaceRepository;

  beforeAll(async () => {
    db = await startPostgis();
    places = new TypeormKnownPlaceRepository(db.dataSource);
    await places.replaceAll([
      record('osm:way:1', 'Parque Ibirapuera', 9, IBIRAPUERA_AREA),
      record(
        'osm:way:2',
        'Shopping Ibirapuera',
        6,
        { type: 'Point', coordinates: [-46.66, -23.61] },
        'shop=mall',
      ),
      record(
        'osm:relation:3',
        'Jardim Botânico de São Paulo',
        8,
        {
          type: 'Point',
          coordinates: [-46.6253, -23.6418],
        },
        'leisure=garden',
      ),
      record('osm:way:4', 'Jardim Botânico', 6, { type: 'Point', coordinates: [-46.7, -23.7] }),
    ]);
  });
  afterAll(() => db?.stop());

  it('área vira centroide', async () => {
    const [row] = await db.dataSource.query<Array<{ lat: number; lon: number }>>(
      `SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
       FROM places WHERE osm_id = 'osm:way:1'`,
    );
    expect(row?.lat).toBeCloseTo(-23.585, 5);
    expect(row?.lon).toBeCloseTo(-46.655, 5);
  });

  it('busca sem acento por início de palavra, importância e depois nome mais curto', async () => {
    const found = await places.searchByName('jardim bot', 8);
    expect(found.map((m) => m.place.id)).toEqual(['osm:relation:3', 'osm:way:4']);
    expect(found[0]?.place).toMatchObject({ name: 'Jardim Botânico de São Paulo', kind: 'poi' });
    expect((await places.searchByName('ibirapuera', 8)).map((m) => m.place.id)).toEqual([
      'osm:way:1',
      'osm:way:2',
    ]);
    expect(await places.searchByName('ib', 1)).toHaveLength(1);
  });

  it('acha o mais próximo dentro do raio', async () => {
    const near = await places.findNearest({ lat: -23.6418, lon: -46.6255 }, 60);
    expect(near?.place.id).toBe('osm:relation:3');
    expect(near?.distanceM).toBeLessThan(60);
    expect(await places.findNearest({ lat: -23.65, lon: -46.6255 }, 60)).toBeNull();
  });

  it('nova importação substitui tudo', async () => {
    const total = await places.replaceAll([
      record('osm:node:9', 'Museu do Ipiranga', 6, {
        type: 'Point',
        coordinates: [-46.61, -23.585],
      }),
    ]);
    expect(total).toBe(1);
    expect(await places.searchByName('ibirapuera', 8)).toEqual([]);
  });
});
