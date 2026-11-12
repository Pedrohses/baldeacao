import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { GtfsArchiveDownloader } from '../../domain/ports/gtfs-archive-downloader.port';

const TIMEOUT_MS = 120_000;
const RETRIES = 2;
const BACKOFF_MS = 500;

/**
 * O HttpClient compartilhado devolve texto; o zip precisa de bytes. Mesmo padrão dele:
 * timeout por tentativa, retry com backoff em erro de rede e 5xx, 4xx não repete.
 */
@Injectable()
export class FetchGtfsArchiveDownloader extends GtfsArchiveDownloader {
  async download(url: string): Promise<Uint8Array> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_MS * 2 ** (attempt - 1));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) return new Uint8Array(await res.arrayBuffer());
        lastError = new Error(`HTTP ${res.status}`);
        if (res.status < 500) break;
      } catch (error) {
        lastError = error;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new SourceUnavailableError('gtfs-sptrans', undefined, { cause: lastError });
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
