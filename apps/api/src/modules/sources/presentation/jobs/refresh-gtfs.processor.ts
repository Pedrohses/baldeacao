import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  RefreshGtfsFeedUseCase,
  type RefreshGtfsFeedResult,
} from '../../application/use-cases/refresh-gtfs-feed.use-case';
import { GTFS_REFRESH_QUEUE, REFRESH_GTFS_JOB } from './gtfs-refresh-queue';

/** Falha vira log (o caso de uso já registra o erro) e o job termina; o feed atual fica. */
@Processor(GTFS_REFRESH_QUEUE)
export class RefreshGtfsProcessor extends WorkerHost {
  private readonly logger = new Logger(RefreshGtfsProcessor.name);

  constructor(private readonly refresh: RefreshGtfsFeedUseCase) {
    super();
  }

  async process(job: Job): Promise<RefreshGtfsFeedResult | null> {
    if (job.name !== REFRESH_GTFS_JOB) return null;
    try {
      return await this.refresh.execute();
    } catch (error) {
      this.logger.warn(
        `Atualização do GTFS falhou, mantendo o feed atual: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
