import type { z } from 'zod';

import { env } from '@/shared/config/env';

export class ApiError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

// status 0 = falha de rede ou resposta fora do contrato (sem status HTTP de erro).
const NETWORK_STATUS = 0;

function messageForStatus(status: number): string {
  if (status === 400 || status === 422)
    return 'Não foi possível concluir o pedido com esses dados.';
  if (status === 404) return 'Não encontramos o que você procurou.';
  if (status === 429) return 'Muitas requisições. Tente de novo em instantes.';
  if (status >= 500) return 'O servidor está com problemas. Tente de novo em instantes.';
  return 'Não foi possível concluir a requisição.';
}

export interface ApiClientOptions {
  baseUrl: string;
  fetchFn?: typeof fetch;
}

export interface ApiClient {
  get<S extends z.ZodType>(path: string, schema: S, init?: RequestInit): Promise<z.output<S>>;
  post<S extends z.ZodType>(
    path: string,
    body: unknown,
    schema: S,
    init?: RequestInit,
  ): Promise<z.output<S>>;
}

export function createApiClient({ baseUrl, fetchFn }: ApiClientOptions): ApiClient {
  const base = baseUrl.replace(/\/+$/, '');

  async function request<S extends z.ZodType>(
    path: string,
    schema: S,
    init: RequestInit & { method: 'GET' | 'POST' },
  ): Promise<z.output<S>> {
    const doFetch = fetchFn ?? fetch;
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

    let response: Response;
    try {
      response = await doFetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(NETWORK_STATUS, 'Sem conexão com o servidor. Verifique sua internet.');
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => undefined);
      throw new ApiError(response.status, messageForStatus(response.status), payload);
    }

    const body: unknown = await response.json().catch(() => undefined);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        NETWORK_STATUS,
        'A resposta do servidor veio em um formato inesperado.',
        parsed.error.issues,
      );
    }
    return parsed.data;
  }

  return {
    get: (path, schema, init) => request(path, schema, { ...init, method: 'GET' }),
    post: (path, body, schema, init) =>
      request(path, schema, { ...init, method: 'POST', body: JSON.stringify(body) }),
  };
}

const defaultClient = createApiClient({ baseUrl: env.apiUrl });

export function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  return defaultClient.get(path, schema, init);
}

export function apiPost<S extends z.ZodType>(
  path: string,
  body: unknown,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  return defaultClient.post(path, body, schema, init);
}
