import type { GtfsShapePoint, RawGtfsFeed } from '../../domain/entities/gtfs-feed.entity';
import {
  GtfsArchiveFiles,
  type GtfsArchiveOverrides,
  type UnpackedGtfs,
} from '../../domain/ports/gtfs-archive-files.port';
import { GtfsFeedReader } from '../../domain/ports/gtfs-feed-reader.port';
import { PrepareGtfsArchiveUseCase } from './prepare-gtfs-archive.use-case';
import { RepairGtfsShapesUseCase } from './repair-gtfs-shapes.use-case';

async function* from<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield await Promise.resolve(item);
}

class InMemoryReader extends GtfsFeedReader {
  opened: string[] = [];
  open(location: string): Promise<RawGtfsFeed> {
    this.opened.push(location);
    const points: GtfsShapePoint[] = [
      { shapeId: 's1', lat: -23.5, lon: -46.6, sequence: 1 },
      { shapeId: 's1', lat: -23.5, lon: -46.59, sequence: 2 },
    ];
    return Promise.resolve({
      routes: () => from([]),
      stops: () => from([]),
      trips: () => from([]),
      stopTimes: () => from([]),
      calendar: () => from([]),
      frequencies: () =>
        from([{ tripId: 't1', startTime: 14400, endTime: 17940, headwaySecs: 600 }]),
      shapePoints: () => from(points),
    });
  }
}

class InMemoryFiles extends GtfsArchiveFiles {
  released = 0;
  packed: { sourceDir: string; output: string; overrides: GtfsArchiveOverrides } | null = null;
  constructor(private readonly failPack = false) {
    super();
  }
  unpack(location: string): Promise<UnpackedGtfs> {
    return Promise.resolve({
      dir: `${location}-extraido`,
      release: () => {
        this.released++;
        return Promise.resolve();
      },
    });
  }
  pack(sourceDir: string, output: string, overrides: GtfsArchiveOverrides): Promise<number> {
    if (this.failPack) return Promise.reject(new Error('disco cheio'));
    this.packed = { sourceDir, output, overrides };
    return Promise.resolve(1234);
  }
}

describe('PrepareGtfsArchiveUseCase', () => {
  it('lê o GTFS extraído, repara os traçados e grava com exact_times=1', async () => {
    const reader = new InMemoryReader();
    const files = new InMemoryFiles();
    const useCase = new PrepareGtfsArchiveUseCase(reader, files, new RepairGtfsShapesUseCase());

    const result = await useCase.execute({ input: '/in/gtfs.zip', output: '/out/gtfs.zip' });

    expect(reader.opened).toEqual(['/in/gtfs.zip-extraido']);
    expect(files.packed?.sourceDir).toBe('/in/gtfs.zip-extraido');
    expect(files.packed?.output).toBe('/out/gtfs.zip');
    expect(files.packed?.overrides.shapes.map((s) => s.shapeId)).toEqual(['s1']);
    expect(files.packed?.overrides.frequencies).toEqual([
      { tripId: 't1', startTime: 14400, endTime: 17940, headwaySecs: 600, exactTimes: true },
    ]);
    expect(result).toMatchObject({ bytes: 1234, shapes: 1, exactFrequencies: 1, shapeRepairs: [] });
    expect(files.released).toBe(1);
  });

  it('libera a pasta extraída mesmo quando a gravação falha', async () => {
    const files = new InMemoryFiles(true);
    const useCase = new PrepareGtfsArchiveUseCase(
      new InMemoryReader(),
      files,
      new RepairGtfsShapesUseCase(),
    );
    await expect(useCase.execute({ input: '/in', output: '/out.zip' })).rejects.toThrow(
      'disco cheio',
    );
    expect(files.released).toBe(1);
  });
});
