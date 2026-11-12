import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class RealtimeDataNotReadyError extends DomainError {
  readonly code = 'REALTIME_DATA_NOT_READY';

  constructor(readonly sourceId: string) {
    super(`Ainda não há posições em tempo real para ${sourceId}. Tente novamente em instantes.`);
  }
}
