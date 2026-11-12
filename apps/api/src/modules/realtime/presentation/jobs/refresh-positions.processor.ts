import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DomainError } from '../../../../shared/domain/errors/domain-error';
import { OlhoVivoAuthError } from '../../../../shared/domain/errors/olho-vivo-auth.error';
import type { PositionsCycleEvent } from '../../domain/ports/positions-cycle-notifier.port';
import { RefreshVehiclePositionsUseCase } from '../../application/use-cases/refresh-vehicle-positions.use-case';
import {
  REALTIME_QUEUE,
  REFRESH_POSITIONS_JOB,
  type RefreshPositionsJobData,
} from './realtime-queue';

/**
 * Consome o job repetível do ciclo. Falha conhecida da fonte (token recusado, fonte fora)
 * vira log e o job termina: o próximo ciclo tenta de novo e o app segue no ar.
 */
@Processor(REALTIME_QUEUE)
export class RefreshPositionsProcessor extends WorkerHost {
  private readonly logger = new Logger(RefreshPositionsProcessor.name);

  constructor(private readonly refreshPositions: RefreshVehiclePositionsUseCase) {
    super();
  }

  async process(job: Job<RefreshPositionsJobData>): Promise<PositionsCycleEvent | null> {
    if (job.name !== REFRESH_POSITIONS_JOB) return null;
    try {
      const event = await this.refreshPositions.execute();
      this.logger.log(`Ciclo ${event.sourceId}: ${event.vehicleCount} veículos gravados.`);
      return event;
    } catch (error) {
      if (error instanceof OlhoVivoAuthError) {
        this.logger.error(`${error.code}: ${error.message}`);
        return null;
      }
      if (error instanceof DomainError) {
        this.logger.warn(`${error.code}: ${error.message}`);
        return null;
      }
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    this.logger.error(`Job ${job?.name ?? '?'} falhou: ${error.message}`, error.stack);
  }
}
