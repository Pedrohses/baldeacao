import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { Injectable } from '@nestjs/common';
import { unzipSync, zipSync } from 'fflate';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import {
  GtfsArchiveFiles,
  type GtfsArchiveOverrides,
  type UnpackedGtfs,
} from '../../domain/ports/gtfs-archive-files.port';
import { cumulativeDistances } from '../../domain/services/shape-geometry';
import { formatGtfsTime } from '../../domain/value-objects/gtfs-values';

/** Zip ou pasta GTFS no disco local; o zip de saída é montado em memória (o da SPTrans tem ~20 MB). */
@Injectable()
export class FsGtfsArchiveFiles extends GtfsArchiveFiles {
  async unpack(location: string): Promise<UnpackedGtfs> {
    const info = await stat(location).catch(() => undefined);
    if (!info) throw new InvalidGtfsFeedError(`GTFS não encontrado: ${location}`);
    if (info.isDirectory()) return { dir: location, release: () => Promise.resolve() };

    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(await readFile(location), { filter: (file) => file.name.endsWith('.txt') });
    } catch (error) {
      throw new InvalidGtfsFeedError(
        `${location} não é um zip válido: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const dir = await mkdtemp(join(tmpdir(), 'gtfs-prepare-'));
    // basename evita que um nome de entrada escape do diretório temporário.
    for (const [name, data] of Object.entries(files)) {
      await writeFile(join(dir, basename(name)), data);
    }
    return { dir, release: () => rm(dir, { recursive: true, force: true }) };
  }

  async pack(sourceDir: string, output: string, overrides: GtfsArchiveOverrides): Promise<number> {
    const files: Record<string, Uint8Array> = {};
    for (const name of (await readdir(sourceDir)).filter((file) => file.endsWith('.txt')).sort()) {
      files[name] = await readFile(join(sourceDir, name));
    }
    const withDistance = (await headerOf(join(sourceDir, 'shapes.txt'))).includes(
      'shape_dist_traveled',
    );
    files['shapes.txt'] = Buffer.from(shapesCsv(overrides.shapes, withDistance));
    if (files['frequencies.txt'] || overrides.frequencies.length > 0) {
      files['frequencies.txt'] = Buffer.from(frequenciesCsv(overrides.frequencies));
    }
    const zipped = zipSync(files, { level: 6 });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, zipped);
    return zipped.byteLength;
  }
}

async function headerOf(path: string): Promise<string[]> {
  const exists = await stat(path).catch(() => undefined);
  if (!exists) return [];
  const lines = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
  for await (const line of lines) {
    lines.close();
    return line
      .replace(/^\uFEFF/, '')
      .split(',')
      .map((column) => column.trim().replace(/^"|"$/g, ''));
  }
  return [];
}

function shapesCsv(shapes: GtfsArchiveOverrides['shapes'], withDistance: boolean): string {
  const header = ['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence'];
  if (withDistance) header.push('shape_dist_traveled');
  const lines = [header.join(',')];
  for (const shape of shapes) {
    const id = csvField(shape.shapeId);
    const distances = withDistance ? cumulativeDistances(shape.points) : [];
    shape.points.forEach((point, i) => {
      const row = [id, point.lat.toFixed(6), point.lon.toFixed(6), String(i + 1)];
      if (withDistance) row.push((distances[i] ?? 0).toFixed(3));
      lines.push(row.join(','));
    });
  }
  return `${lines.join('\n')}\n`;
}

function frequenciesCsv(frequencies: GtfsArchiveOverrides['frequencies']): string {
  const lines = ['trip_id,start_time,end_time,headway_secs,exact_times'];
  for (const f of frequencies) {
    lines.push(
      [
        csvField(f.tripId),
        formatGtfsTime(f.startTime),
        formatGtfsTime(f.endTime),
        String(f.headwaySecs),
        f.exactTimes ? '1' : '0',
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
