import {
  POSTGIS_TEST_TIMEOUT_MS,
  startPostgis,
  type PostgisTestDatabase,
} from '../../../../../test/support/postgis-container';
import { Place } from '../../domain/entities/place.entity';
import { TypeormGeocodeCacheRepository } from './typeorm-geocode-cache.repository';

jest.setTimeout(POSTGIS_TEST_TIMEOUT_MS);

const MORUMBIS = new Place({
  id: 'osm:way:23935207',
  name: 'Estádio do Morumbis',
  address: 'Praça Roberto Gomes Pedrosa, 1, Morumbi, São Paulo',
  kind: 'poi',
  location: { lat: -23.6001163, lon: -46.720235 },
});

describe('TypeormGeocodeCacheRepository (Testcontainers + PostGIS)', () => {
  let db: PostgisTestDatabase;
  let cache: TypeormGeocodeCacheRepository;

  beforeAll(async () => {
    db = await startPostgis();
    cache = new TypeormGeocodeCacheRepository(db.dataSource);
  });
  afterAll(() => db?.stop());

  it('grava e lê os lugares pela chave', async () => {
    await cache.set('estádio do morumbis', 'Estádio do Morumbis', [MORUMBIS], 3600);
    expect(await cache.get('estádio do morumbis')).toEqual([MORUMBIS]);
    expect(await cache.get('outra consulta')).toBeNull();
  });

  it('guarda lista vazia (busca sem resultado também é cache)', async () => {
    await cache.set('nada aqui', 'nada aqui', [], 3600);
    expect(await cache.get('nada aqui')).toEqual([]);
  });

  it('registro expirado não é devolvido', async () => {
    await cache.set('expirado', 'expirado', [MORUMBIS], -1);
    expect(await cache.get('expirado')).toBeNull();
  });

  it('nova gravação da mesma chave substitui resultado e prazo', async () => {
    await cache.set('renova', 'renova', [], -1);
    await cache.set('renova', 'Renova', [MORUMBIS], 30 * 24 * 3600);
    expect(await cache.get('renova')).toEqual([MORUMBIS]);
    const [row] = await db.dataSource.query<Array<{ query: string; days: string }>>(
      `SELECT query, round(extract(epoch FROM expires_at - now()) / 86400) AS days
       FROM geocode_cache WHERE query_key = 'renova'`,
    );
    expect(row).toEqual({ query: 'Renova', days: '30' });
  });
});
