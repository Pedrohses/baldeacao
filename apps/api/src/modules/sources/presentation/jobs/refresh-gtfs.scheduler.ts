import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { AppConfig } from '../../../../config';
import { GTFS_REFRESH_QUEUE, GTFS_REFRESH_TIMEZONE, REFRESH_GTFS_JOB } from './gtfs-refresh-queue';

/** Registra o job repetível (idempotente: várias instâncias mantêm um só agendamento). */
@Injectable()
export class RefreshGtfsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefreshGtfsScheduler.name);

  constructor(
    @InjectQueue(GTFS_REFRESH_QUEUE) private readonly queue: Queue,
    private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    // Sem await: Redis fora não pode travar a subida do app.
    void this.schedule().catch((error: unknown) =>
      this.logger.error(
        `Não foi possível agendar a atualização do GTFS: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  async schedule(): Promise<void> {
    const pattern = this.config.gtfsRefreshCron;
    await this.queue.upsertJobScheduler(
      REFRESH_GTFS_JOB,
      { pattern, tz: GTFS_REFRESH_TIMEZONE },
      { name: REFRESH_GTFS_JOB, opts: { removeOnComplete: 20, removeOnFail: 20 } },
    );
    this.logger.log(`Atualização do GTFS agendada ("${pattern}", ${GTFS_REFRESH_TIMEZONE}).`);
  }
}
