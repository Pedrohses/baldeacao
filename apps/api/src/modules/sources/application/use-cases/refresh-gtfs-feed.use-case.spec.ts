import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { zipSync } from 'fflate';
import type { AppConfig } from '../../../../config';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { GtfsArchiveDownloader } from '../../domain/ports/gtfs-archive-downloader.port';
import {
  GtfsImportStateStore,
  type GtfsImportState,
} from '../../domain/ports/gtfs-import-state-store.port';
import type { ImportGtfsFeedInput } from '../dto/import-gtfs-feed.dto';
import type { ImportGtfsFeedUseCase } from './import-gtfs-feed.use-case';
import { RefreshGtfsFeedUseCase } from './refresh-gtfs-feed.use-case';

const OFFICIAL = 'https://oficial.test/gtfs.zip';
const FALLBACK = 'https://espelho.test/gtfs.zip';
const FIXTURE = join(__dirname, '../../../../../test/fixtures/gtfs/sptrans-mini');

// Zip montado em memória a partir da fixture; `extra` muda o conteúdo (e o hash).
function buildZip(extra = ''): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const name of readdirSync(FIXTURE).filter((f) => f.endsWith('.txt'))) {
    files[name] = readFileSync(join(FIXTURE, name));
  }
  files['agency.txt'] = Buffer.concat([
    readFileSync(join(FIXTURE, 'agency.txt')),
    Buffer.from(extra),
  ]);
  return zipSync(files);
}

type Responses = Record<string, Uint8Array | Error>;

class FakeDownloader extends GtfsArchiveDownloader {
  calls: string[] = [];
  constructor(private readonly responses: Responses) {
    super();
  }
  download(url: string): Promise<Uint8Array> {
    this.calls.push(url);
    const response = this.responses[url];
    if (response === undefined || response instanceof Error) {
      return Promise.reject(response ?? new SourceUnavailableError('gtfs-sptrans'));
    }
    return Promise.resolve(response);
  }
}

class InMemoryState extends GtfsImportStateStore {
  saved = new Map<string, GtfsImportState>();
  get(sourceId: string): Promise<GtfsImportState | null> {
    return Promise.resolve(this.saved.get(sourceId) ?? null);
  }
  save(sourceId: string, state: GtfsImportState): Promise<void> {
    this.saved.set(sourceId, state);
    return Promise.resolve();
  }
}

const config = { gtfsSptransUrl: OFFICIAL, gtfsSptransFallbackUrl: FALLBACK } as AppConfig;

function setup(responses: Responses, failImport = false) {
  const downloader = new FakeDownloader(responses);
  const state = new InMemoryState();
  const imported: { input: ImportGtfsFeedInput; files: string[] }[] = [];
  const importer = {
    execute: (input: ImportGtfsFeedInput) => {
      if (failImport) return Promise.reject(new Error('banco fora'));
      imported.push({ input, files: readdirSync(input.location).sort() });
      return Promise.resolve({
        sourceId: input.sourceId,
        counts: { routes: 3 },
        skippedShapes: [],
        durationMs: 1,
      });
    },
  } as unknown as ImportGtfsFeedUseCase;
  const useCase = new RefreshGtfsFeedUseCase(config, downloader, state, importer);
  return { downloader, state, imported, useCase };
}

describe('RefreshGtfsFeedUseCase', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('mesmo hash não reimporta', async () => {
    const { useCase, imported } = setup({ [OFFICIAL]: buildZip() });

    expect((await useCase.execute()).status).toBe('imported');
    expect((await useCase.execute()).status).toBe('unchanged');
    expect(imported).toHaveLength(1);
  });

  it('hash novo reimporta e grava o hash', async () => {
    const responses: Responses = { [OFFICIAL]: buildZip() };
    const { useCase, imported, state } = setup(responses);
    await useCase.execute();
    responses[OFFICIAL] = buildZip('\n');

    const result = await useCase.execute();

    expect(result.status).toBe('imported');
    expect(imported).toHaveLength(2);
    expect(imported[1]?.files).toContain('routes.txt');
    expect((await state.get('sptrans'))?.sha256).toBe(result.sha256);
  });

  it('oficial falha e o fallback funciona', async () => {
    const { useCase, downloader } = setup({
      [OFFICIAL]: new Error('fora'),
      [FALLBACK]: buildZip(),
    });

    expect((await useCase.execute()).status).toBe('imported');
    expect(downloader.calls).toEqual([OFFICIAL, FALLBACK]);
  });

  it('falha total não grava hash nem importa', async () => {
    const { useCase, state, imported } = setup({
      [OFFICIAL]: new Error('a'),
      [FALLBACK]: new Error('b'),
    });

    await expect(useCase.execute()).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(state.saved.size).toBe(0);
    expect(imported).toHaveLength(0);
  });

  it('importação que falha não grava hash', async () => {
    const { useCase, state } = setup({ [OFFICIAL]: buildZip() }, true);

    await expect(useCase.execute()).rejects.toThrow('banco fora');
    expect(state.saved.size).toBe(0);
  });
});
