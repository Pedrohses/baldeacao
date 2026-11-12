import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { unzipSync } from 'fflate';
import { AppConfig } from '../../../../config';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { InvalidGtfsFeedError } from '../../domain/errors/invalid-gtfs-feed.error';
import { GtfsArchiveDownloader } from '../../domain/ports/gtfs-archive-downloader.port';
import { GtfsImportStateStore } from '../../domain/ports/gtfs-import-state-store.port';
import type { ImportGtfsFeedResult } from '../dto/import-gtfs-feed.dto';
import { ImportGtfsFeedUseCase } from './import-gtfs-feed.use-case';

export const GTFS_REFRESH_SOURCE_ID = 'sptrans';

export type RefreshGtfsFeedResult =
  | { status: 'unchanged'; sha256: string }
  | { status: 'imported'; sha256: string; import: ImportGtfsFeedResult };

@Injectable()
export class RefreshGtfsFeedUseCase {
  private readonly logger = new Logger(RefreshGtfsFeedUseCase.name);

  constructor(
    private readonly config: AppConfig,
    private readonly downloader: GtfsArchiveDownloader,
    private readonly state: GtfsImportStateStore,
    private readonly importer: ImportGtfsFeedUseCase,
  ) {}

  async execute(sourceId: string = GTFS_REFRESH_SOURCE_ID): Promise<RefreshGtfsFeedResult> {
    try {
      const archive = await this.downloadWithFallback();
      const sha256 = createHash('sha256').update(archive).digest('hex');
      const last = await this.state.get(sourceId);
      if (last?.sha256 === sha256) {
        this.logger.log(`GTFS ${sourceId} inalterado (sha256 ${sha256.slice(0, 12)}).`);
        return { status: 'unchanged', sha256 };
      }

      const dir = await mkdtemp(join(tmpdir(), 'gtfs-'));
      try {
        await extract(archive, dir);
        const result = await this.importer.execute({ sourceId, location: dir });
        // O hash só vale depois que a troca do feed foi confirmada.
        await this.state.save(sourceId, { sha256, importedAt: new Date().toISOString() });
        const counts = Object.entries(result.counts)
          .map(([table, total]) => `${table}=${total}`)
          .join(' ');
        this.logger.log(`GTFS ${sourceId} importado em ${result.durationMs} ms: ${counts}`);
        return { status: 'imported', sha256, import: result };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.error(
        `Falha ao atualizar o GTFS ${sourceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async downloadWithFallback(): Promise<Uint8Array> {
    const { gtfsSptransUrl, gtfsSptransFallbackUrl } = this.config;
    try {
      return await this.downloader.download(gtfsSptransUrl);
    } catch (error) {
      this.logger.warn(
        `Download oficial do GTFS falhou (${error instanceof Error ? error.message : String(error)}); tentando o espelho.`,
      );
      try {
        return await this.downloader.download(gtfsSptransFallbackUrl);
      } catch (fallbackError) {
        throw new SourceUnavailableError(
          'gtfs-sptrans',
          'Não foi possível baixar o GTFS da SPTrans nem pela URL oficial nem pelo espelho.',
          { cause: fallbackError },
        );
      }
    }
  }
}

async function extract(archive: Uint8Array, dir: string): Promise<void> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(archive, { filter: (file) => file.name.endsWith('.txt') });
  } catch (error) {
    throw new InvalidGtfsFeedError(
      `O arquivo baixado não é um zip válido: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  // basename evita que um nome de entrada escape do diretório temporário.
  for (const [name, data] of Object.entries(files)) {
    await writeFile(join(dir, basename(name)), data);
  }
}
