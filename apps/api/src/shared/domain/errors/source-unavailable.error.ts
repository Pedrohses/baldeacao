import { DomainError } from './domain-error';

export class SourceUnavailableError extends DomainError {
  readonly code = 'SOURCE_UNAVAILABLE';

  constructor(
    readonly source: string,
    message: string = `A fonte de dados ${source} está indisponível no momento. Tente novamente em instantes.`,
    options?: { cause?: unknown },
  ) {
    super(message);
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
