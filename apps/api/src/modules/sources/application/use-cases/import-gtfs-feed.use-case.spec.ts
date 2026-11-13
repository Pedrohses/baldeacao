import type {
  GtfsFeed,
  GtfsImportCounts,
  GtfsShape,
  GtfsShapePoint,
  RawGtfsFeed,
} from '../../domain/entities/gtfs-feed.entity';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import { GtfsFeedReader } from '../../domain/ports/gtfs-feed-reader.port';
import { GtfsFeedStore } from '../../domain/ports/gtfs-feed-store.port';
import { ImportGtfsFeedUseCase } from './import-gtfs-feed.use-case';

async function* from<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield await Promise.resolve(item);
}

async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = [];
  for await (const item of items) all.push(item);
  return all;
}

class InMemoryGtfsFeedReader extends GtfsFeedReader {
  opened: string[] = [];
  constructor(private readonly shapePoints: GtfsShapePoint[]) {
    super();
  }
  open(location: string): Promise<RawGtfsFeed> {
    this.opened.push(location);
    return Promise.resolve({
      routes: () =>
        from([
          {
            routeId: 'r1',
            agencyId: null,
            shortName: 'R1',
            longName: '',
            routeType: 3,
            color: null,
            textColor: null,
          },
        ]),
      stops: () => from([]),
      trips: () => from([]),
      stopTimes: () => from([]),
      calendar: () => from([]),
      frequencies: () => from([]),
      shapePoints: () => from(this.shapePoints),
    });
  }
}

class InMemoryGtfsFeedStore extends GtfsFeedStore {
  readonly saved = new Map<string, { routes: number; shapes: GtfsShape[] }>();
  async replace(sourceId: string, feed: GtfsFeed): Promise<GtfsImportCounts> {
    const routes = await collect(feed.routes());
    const shapes = await collect(feed.shapes());
    this.saved.set(sourceId, { routes: routes.length, shapes });
    return {
      routes: routes.length,
      stops: 0,
      trips: 0,
      stopTimes: 0,
      calendar: 0,
      frequencies: 0,
      shapes: shapes.length,
    };
  }
}

describe('ImportGtfsFeedUseCase', () => {
  it('monta os shapes e entrega o feed ao store da fonte', async () => {
    const reader = new InMemoryGtfsFeedReader([
      { shapeId: 's1', lat: -23.2, lon: -46.2, sequence: 2 },
      { shapeId: 's1', lat: -23.1, lon: -46.1, sequence: 1 },
      { shapeId: 's2', lat: -23.1, lon: -46.1, sequence: 1 },
    ]);
    const store = new InMemoryGtfsFeedStore();

    const result = await new ImportGtfsFeedUseCase(reader, store).execute({
      sourceId: 'sptrans',
      location: '/gtfs',
    });

    expect(reader.opened).toEqual(['/gtfs']);
    expect(result.sourceId).toBe('sptrans');
    expect(result.counts.routes).toBe(1);
    expect(result.counts.shapes).toBe(1);
    expect(result.skippedShapes).toEqual(['s2']);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(store.saved.get('sptrans')?.shapes).toEqual([
      {
        shapeId: 's1',
        points: [
          { lat: -23.1, lon: -46.1 },
          { lat: -23.2, lon: -46.2 },
        ],
      },
    ]);
  });

  it('grava os traçados já reparados (mesmo reparo do gtfs:prepare)', async () => {
    // Ônibus cujo traçado segue ~1,1 km depois da última parada: a ponta é cortada.
    const points: GtfsShapePoint[] = Array.from({ length: 31 }, (_, i) => ({
      shapeId: 's1',
      lat: -23.55,
      lon: -46.6 + i * 0.001,
      sequence: i + 1,
    }));
    const raw: RawGtfsFeed = {
      routes: () =>
        from([
          {
            routeId: 'r1',
            agencyId: null,
            shortName: 'R1',
            longName: '',
            routeType: 3,
            color: null,
            textColor: null,
          },
        ]),
      stops: () =>
        from([
          { stopId: 'a', code: null, name: 'A', description: null, lat: -23.55, lon: -46.6 },
          { stopId: 'b', code: null, name: 'B', description: null, lat: -23.55, lon: -46.58 },
        ]),
      trips: () =>
        from([
          {
            tripId: 't1',
            routeId: 'r1',
            serviceId: 'U',
            headsign: null,
            directionId: 0 as const,
            shapeId: 's1',
          },
        ]),
      stopTimes: () =>
        from([
          { tripId: 't1', stopId: 'a', stopSequence: 1, arrivalTime: 0, departureTime: 0 },
          { tripId: 't1', stopId: 'b', stopSequence: 2, arrivalTime: 60, departureTime: 60 },
        ]),
      calendar: () => from([]),
      frequencies: () => from([]),
      shapePoints: () => from(points),
    };
    const reader = new (class extends GtfsFeedReader {
      open(): Promise<RawGtfsFeed> {
        return Promise.resolve(raw);
      }
    })();
    const store = new InMemoryGtfsFeedStore();

    const result = await new ImportGtfsFeedUseCase(reader, store).execute({
      sourceId: 'sptrans',
      location: '/gtfs',
    });

    expect(result.shapeRepairs).toEqual([{ shapeId: 's1', kind: 'end-trimmed', meters: 1019 }]);
    const saved = store.saved.get('sptrans')?.shapes[0]?.points ?? [];
    expect(saved).toHaveLength(21);
    expect(saved.at(-1)?.lon).toBeCloseTo(-46.58, 6);
  });

  it('recusa source id fora do padrão sem abrir o feed', async () => {
    const reader = new InMemoryGtfsFeedReader([]);
    const useCase = new ImportGtfsFeedUseCase(reader, new InMemoryGtfsFeedStore());

    await expect(useCase.execute({ sourceId: 'SP Trans', location: '/gtfs' })).rejects.toThrow(
      InvalidGtfsFeedError,
    );
    expect(reader.opened).toEqual([]);
  });
});
