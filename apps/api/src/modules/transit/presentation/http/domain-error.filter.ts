import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@baldeacao/types';
import { DomainError } from '../../../../shared/domain/errors/domain-error';

// Só o que o filtro usa da resposta do Express (sem depender de @types/express).
interface JsonResponse {
  status(code: number): { json(body: unknown): void };
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_QUERY: HttpStatus.BAD_REQUEST,
  LINE_NOT_FOUND: HttpStatus.NOT_FOUND,
  SOURCE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  // Token ausente ou recusado: para o cliente, a fonte está indisponível.
  OLHO_VIVO_AUTH_FAILED: HttpStatus.SERVICE_UNAVAILABLE,
};

/** Converte DomainError no corpo ApiErrorBody com o status HTTP do code. */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(error: DomainError, host: ArgumentsHost): void {
    const status: number = STATUS_BY_CODE[error.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) this.logger.warn(`${error.code}: ${error.message}`);
    const body: ApiErrorBody = { code: error.code, message: error.message };
    host.switchToHttp().getResponse<JsonResponse>().status(status).json(body);
  }
}
