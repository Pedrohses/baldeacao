import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class StopNotFoundError extends DomainError {
  readonly code = 'STOP_NOT_FOUND';

  constructor(readonly stopId: string) {
    super(`Parada ${stopId} não encontrada.`);
  }
}
