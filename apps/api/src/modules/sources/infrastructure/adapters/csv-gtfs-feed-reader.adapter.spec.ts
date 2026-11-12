import { cp, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GTFS_MINI_DIR } from '../../../../../test/support/postgis-container';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import { CsvGtfsFeedReader } from './csv-gtfs-feed-reader.adapter';

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = [];
  for await (const item of items) all.push(item);
  return all;
}

describe('CsvGtfsFeedReader', () => {
  const reader = new CsvGtfsFeedReader();

  it('lê o recorte sptrans-mini com os tipos certos', async () => {
    const feed = await reader.open(GTFS_MINI_DIR);

    const routes = await collect(feed.routes());
    expect(routes).toHaveLength(3);
    expect(routes).toContainEqual({
      routeId: '875A-10',
      agencyId: '1',
      shortName: '875A-10',
      longName: 'Perdizes - Aeroporto',
      routeType: 3,
      color: '509E2F',
      textColor: 'FFFFFF',
    });

    const stops = await collect(feed.stops());
    expect(stops).toHaveLength(13);
    expect(stops).toContainEqual({
      stopId: '4301848',
      code: null,
      name: 'Av. Paulista 1578',
      description: 'Em frente ao MASP',
      lat: -23.5614,
      lon: -46.6559,
    });

    const trips = await collect(feed.trips());
    expect(trips).toContainEqual({
      tripId: '875A-10-0',
      routeId: '875A-10',
      serviceId: 'U',
      headsign: 'AEROPORTO',
      directionId: 0,
      shapeId: '84609',
    });

    const stopTimes = await collect(feed.stopTimes());
    expect(stopTimes).toHaveLength(28);
    expect(stopTimes).toContainEqual({
      tripId: '8000-10-0',
      stopId: '4200961',
      stopSequence: 2,
      arrivalTime: 480,
      departureTime: 480,
    });

    expect(await collect(feed.calendar())).toEqual([
      {
        serviceId: 'U',
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ]);
    expect(await collect(feed.frequencies())).toContainEqual({
      tripId: '8000-10-0',
      startTime: 18_000,
      endTime: 32_400,
      headwaySecs: 360,
    });
    expect(await collect(feed.shapePoints())).toHaveLength(42);
  });

  describe('com uma cópia alterada do recorte', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'gtfs-'));
      await cp(GTFS_MINI_DIR, dir, { recursive: true });
    });
    afterEach(() => rm(dir, { recursive: true, force: true }));

    it('recusa pasta sem arquivo obrigatório', async () => {
      await unlink(join(dir, 'stop_times.txt'));
      await expect(reader.open(dir)).rejects.toThrow(InvalidGtfsFeedError);
    });

    it('trata arquivos opcionais ausentes como vazios', async () => {
      await unlink(join(dir, 'frequencies.txt'));
      await unlink(join(dir, 'shapes.txt'));
      const feed = await reader.open(dir);
      expect(await collect(feed.frequencies())).toEqual([]);
      expect(await collect(feed.shapePoints())).toEqual([]);
    });

    it('aponta arquivo e linha quando um campo é inválido', async () => {
      await writeFile(
        join(dir, 'stops.txt'),
        'stop_id,stop_name,stop_lat,stop_lon\n1,Ok,-23.5,-46.6\n2,Ruim,abc,-46.6\n',
      );
      const feed = await reader.open(dir);
      await expect(collect(feed.stops())).rejects.toThrow(
        'stops.txt, linha 3: stop_lat não é número.',
      );
    });
  });

  it('recusa caminho que não é pasta', async () => {
    await expect(reader.open(join(GTFS_MINI_DIR, 'nao-existe'))).rejects.toThrow(
      'Pasta do GTFS não encontrada',
    );
  });
});
