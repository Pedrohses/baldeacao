import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorBody } from '@baldeacao/types';
import { DomainError } from '../domain/errors/domain-error';
import { SourceUnavailableError } from '../domain/errors/source-unavailable.error';
import { friendlySourceMessage } from './source-messages';

// Só o que o filtro usa do Express (sem depender de @types/express).
interface HttpRequestLike {
  method?: string;
  url?: string;
}
interface JsonResponse {
  headersSent?: boolean;
  status(code: number): { json(body: unknown): void };
}

const CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'INVALID_QUERY',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SOURCE_UNAVAILABLE',
};

const STATUS_BY_DOMAIN_CODE: Record<string, number> = {
  INVALID_QUERY: HttpStatus.BAD_REQUEST,
  LINE_NOT_FOUND: HttpStatus.NOT_FOUND,
  STOP_NOT_FOUND: HttpStatus.NOT_FOUND,
  SOURCE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  OLHO_VIVO_AUTH_FAILED: HttpStatus.SERVICE_UNAVAILABLE,
  REALTIME_DATA_NOT_READY: HttpStatus.SERVICE_UNAVAILABLE,
};

const INTERNAL_MESSAGE = 'Falha interna ao processar o pedido. Tente novamente em instantes.';

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.code === 'string' && typeof body.message === 'string';
}

/** Mensagem em português para o que o Nest e o Express levantam sem ApiErrorBody. */
function defaultMessage(code: number, request: HttpRequestLike, original: string): string {
  const status = code as HttpStatus;
  if (status === HttpStatus.NOT_FOUND) {
    return `Rota não encontrada: ${request.method ?? 'GET'} ${(request.url ?? '').split('?')[0]}.`;
  }
  if (status === HttpStatus.BAD_REQUEST && /JSON/i.test(original)) {
    return 'Corpo da requisição não é um JSON válido.';
  }
  if (status === HttpStatus.PAYLOAD_TOO_LARGE) return 'Corpo da requisição grande demais.';
  if (status === HttpStatus.TOO_MANY_REQUESTS) {
    return 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente de novo.';
  }
  if (status === HttpStatus.BAD_REQUEST) return 'Requisição inválida.';
  if (code >= 500) return INTERNAL_MESSAGE;
  return 'Não foi possível atender a requisição.';
}

/**
 * Filtro global: toda resposta de erro sai como ApiErrorBody `{ code, message }` em português,
 * inclusive rota inexistente (404), JSON inválido (400) e erro inesperado (500). Fonte fora do
 * ar (503) usa o texto amigável da fonte, sem nomes internos. Filtros por controller vêm antes.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<JsonResponse>();
    if (host.getType() !== 'http' || response.headersSent) return;
    const request = http.getRequest<HttpRequestLike>();
    const { status, body } = this.toBody(exception, request);
    if (status >= 500) this.logger.warn(`${status} ${body.code}: ${describe(exception)}`);
    response.status(status).json(body);
  }

  private toBody(
    exception: unknown,
    request: HttpRequestLike,
  ): { status: number; body: ApiErrorBody } {
    if (exception instanceof SourceUnavailableError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: { code: exception.code, message: friendlySourceMessage(exception) },
      };
    }
    if (exception instanceof DomainError) {
      const status = STATUS_BY_DOMAIN_CODE[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = status >= 500 && status !== 503 ? INTERNAL_MESSAGE : exception.message;
      return { status, body: { code: exception.code, message } };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (isApiErrorBody(payload)) {
        return { status, body: { code: payload.code, message: payload.message } };
      }
      return {
        status,
        body: {
          code: CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR'),
          message: defaultMessage(status, request, exception.message),
        },
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE },
    };
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
