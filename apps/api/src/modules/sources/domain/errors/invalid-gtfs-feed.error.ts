import { DomainError } from '../../../../shared/domain/errors/domain-error';

export class InvalidGtfsFeedError extends DomainError {
  readonly code = 'INVALID_GTFS_FEED';
}
