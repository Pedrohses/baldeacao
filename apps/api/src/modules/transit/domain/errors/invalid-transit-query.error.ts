import { DomainError } from '../../../../shared/domain/errors/domain-error';

/** Entrada fora das regras do caso de uso (texto curto demais, coordenada inválida etc.). */
export class InvalidTransitQueryError extends DomainError {
  readonly code = 'INVALID_QUERY';
}
