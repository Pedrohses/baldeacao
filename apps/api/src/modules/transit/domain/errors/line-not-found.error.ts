import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class LineNotFoundError extends DomainError {
  readonly code = 'LINE_NOT_FOUND';

  constructor(readonly routeId: string) {
    super(`Linha ${routeId} não encontrada.`);
  }
}
