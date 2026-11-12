import { DomainError } from '../../../../shared/domain/errors/domain-error';

/** Texto de busca de lugar fora das regras (vazio ou curto demais). */
export class InvalidPlaceQueryError extends DomainError {
  readonly code = 'INVALID_QUERY';
}
