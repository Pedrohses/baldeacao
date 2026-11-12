import { DomainError } from '../../../../shared/domain/errors/domain-error';

/** Pedido de viagem fora das regras (coordenada inválida, duas horas, data inválida). */
export class InvalidTripRequestError extends DomainError {
  readonly code = 'INVALID_QUERY';
}
