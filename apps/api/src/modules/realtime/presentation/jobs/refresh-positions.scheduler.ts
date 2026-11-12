import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { REALTIME_CYCLE_MS } from '@baldeacao/types';
import type { Queue } from 'bullmq';
import { VehiclePositionsSourcePort } from '../../domain/ports/vehicle-positions-source.port';
import {
  REALTIME_QUEUE,
  REFRESH_POSITIONS_JOB,
  type RefreshPositionsJobData,
} from './realtime-queue';

/**
 * Registra o job repetível do ciclo. upsertJobScheduler é idempotente: várias instâncias da
 * API mantêm um único agendamento, e cada execução cai em um só worker.
 */
@Injectable()
export class RefreshPositionsScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefreshPositionsScheduler.name);

  constructor(
    @InjectQueue(REALTIME_QUEUE) private readonly queue: Queue<RefreshPositionsJobData>,
    private readonly source: VehiclePositionsSourcePort,
  ) {}

  onApplicationBootstrap(): void {
    // Sem await: Redis fora não pode travar a subida do app.
    void this.schedule().catch((error: unknown) =>
      this.logger.error(
        `Não foi possível agendar o ciclo de posições: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  async schedule(): Promise<void> {
    const sourceId = this.source.sourceId;
    await this.queue.upsertJobScheduler(
      `${REFRESH_POSITIONS_JOB}:${sourceId}`,
      { every: REALTIME_CYCLE_MS },
      {
        name: REFRESH_POSITIONS_JOB,
        data: { sourceId },
        opts: { removeOnComplete: 50, removeOnFail: 50 },
      },
    );
    this.logger.log(`Ciclo de posições de ${sourceId} agendado a cada ${REALTIME_CYCLE_MS} ms.`);
  }
}
