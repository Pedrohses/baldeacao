import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { PrepareGtfsArchiveUseCase } from '../../application/use-cases/prepare-gtfs-archive.use-case';
import { RepairGtfsShapesUseCase } from '../../application/use-cases/repair-gtfs-shapes.use-case';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import { assembleShapes } from '../../domain/services/assemble-shapes';
import {
  distanceMeters,
  type LatLon,
  longestSegment,
  vectorMeters,
} from '../../domain/services/shape-geometry';
import { CsvGtfsFeedReader } from './csv-gtfs-feed-reader.adapter';
import { FsGtfsArchiveFiles } from './fs-gtfs-archive-files.adapter';

// Recorte real do GTFS da SPTrans: L3, L11 e L12 no sentido 0 (ver README da fixture).
const FIXTURE = join(__dirname, '../../../../../test/fixtures/gtfs/sptrans-trilho-bras');
const BRAS_CPTM = { lat: -23.545461, lon: -46.616228 };
const TATUAPE = { lat: -23.5403, lon: -46.5767 };

function maxReturnArm(points: LatLon[]): number {
  let worst = 0;
  for (let i = 1; i + 1 < points.length; i++) {
    const u = vectorMeters(points[i - 1] as LatLon, points[i] as LatLon);
    const v = vectorMeters(points[i] as LatLon, points[i + 1] as LatLon);
    const lu = Math.hypot(u.x, u.y);
    const lv = Math.hypot(v.x, v.y);
    if ((u.x * v.x + u.y * v.y) / (lu * lv) < Math.cos((150 * Math.PI) / 180)) {
      worst = Math.max(worst, Math.min(lu, lv));
    }
  }
  return worst;
}

describe('FsGtfsArchiveFiles + gtfs:prepare no recorte real Brás-Tatuapé', () => {
  let dir: string;
  const files = new FsGtfsArchiveFiles();
  const reader = new CsvGtfsFeedReader();

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'gtfs-prepare-spec-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function prepare() {
    const output = join(dir, 'saida', 'sptrans.zip');
    const result = await new PrepareGtfsArchiveUseCase(
      reader,
      files,
      new RepairGtfsShapesUseCase(),
    ).execute({ input: FIXTURE, output });
    return { output, result };
  }

  it('grava zip com shapes reparados, shape_dist_traveled e exact_times=1', async () => {
    const { output, result } = await prepare();
    expect(result.shapeRepairs).toEqual(
      expect.arrayContaining([
        { shapeId: '17854', kind: 'gap-filled', meters: 4107, borrowedFrom: '17842' },
        { shapeId: '17856', kind: 'start-extended', meters: 4081, borrowedFrom: '17854' },
        { shapeId: '17842', kind: 'spike-removed', meters: 209 },
      ]),
    );

    const entries = unzipSync(await readFile(output));
    expect(Object.keys(entries).sort()).toEqual([
      'frequencies.txt',
      'routes.txt',
      'shapes.txt',
      'stop_times.txt',
      'stops.txt',
      'trips.txt',
    ]);
    const frequencies = strFromU8(entries['frequencies.txt'] as Uint8Array)
      .trim()
      .split('\n');
    expect(frequencies[0]).toBe('trip_id,start_time,end_time,headway_secs,exact_times');
    expect(frequencies[1]).toBe('CPTM L11-0,04:00:00,04:59:00,480,1');
    expect(frequencies).toHaveLength(7);
    // Arquivos sem reparo vão byte a byte.
    expect(entries['stops.txt']).toEqual(
      new Uint8Array(await readFile(join(FIXTURE, 'stops.txt'))),
    );

    const shapesCsv = strFromU8(entries['shapes.txt'] as Uint8Array).split('\n');
    expect(shapesCsv[0]).toBe(
      'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence,shape_dist_traveled',
    );
    expect(shapesCsv[1]).toMatch(/^\d+,-23\.\d{6},-46\.\d{6},1,0\.000$/);
  });

  it('o zip gerado reabre pelo unpack e tem L12 desde o Brás, L11 sem salto e L3 sem espinho', async () => {
    const { output } = await prepare();
    const unpacked = await files.unpack(output);
    try {
      const raw = await reader.open(unpacked.dir);
      const { shapes } = await assembleShapes(raw.shapePoints());
      const points = (id: string) => shapes.find((s) => s.shapeId === id)?.points ?? [];

      const l12 = points('17856');
      expect(distanceMeters(l12[0] as LatLon, BRAS_CPTM)).toBeLessThan(150);
      expect(l12.some((p) => distanceMeters(p, TATUAPE) < 50)).toBe(true);
      expect(longestSegment(l12)).toBeLessThan(1000);

      expect(longestSegment(points('17854'))).toBeLessThan(500);
      expect(maxReturnArm(points('17842'))).toBeLessThan(50);
      expect(maxReturnArm(points('17854'))).toBeLessThan(50);
      expect(maxReturnArm(l12)).toBeLessThan(50);
    } finally {
      await unpacked.release();
    }
  });

  it('recusa entrada que não existe ou não é zip', async () => {
    await expect(files.unpack(join(dir, 'nada.zip'))).rejects.toBeInstanceOf(InvalidGtfsFeedError);
    await expect(files.unpack(join(FIXTURE, 'README.md'))).rejects.toBeInstanceOf(
      InvalidGtfsFeedError,
    );
  });
});
