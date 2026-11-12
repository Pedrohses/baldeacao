import { SourceUnavailableError } from '../../domain/errors/source-unavailable.error';

export type FetchFn = typeof fetch;

export interface HttpClientOptions {
  /** Name used in SourceUnavailableError (e.g. "olho-vivo"). */
  source: string;
  baseUrl?: string;
  userAgent?: string;
  /** Per-attempt timeout. Default 10s. */
  timeoutMs?: number;
  /** Extra attempts after the first one. Default 2. */
  retries?: number;
  /** Base delay for exponential backoff (delay = base * 2^(retry-1)). Default 200ms. */
  backoffMs?: number;
  headers?: Record<string, string>;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  /** Omit for an empty body; POST/PUT/PATCH then send Content-Length: 0. */
  body?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  /** All Set-Cookie header values (not merged). */
  setCookies: string[];
  text: string;
  json<T = unknown>(): T;
}

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);
const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries network errors, timeouts and 5xx. 4xx responses are returned as-is
 * (never retried) so callers can react, e.g. re-login on 401.
 * Throws SourceUnavailableError when attempts are exhausted.
 */
export class HttpClient {
  private readonly fetchFn: FetchFn;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: HttpClientOptions) {
    this.fetchFn = options.fetch ?? ((input, init) => fetch(input, init));
    this.sleep = options.sleep ?? defaultSleep;
  }

  get(
    path: string,
    options: Omit<HttpRequestOptions, 'method' | 'body'> = {},
  ): Promise<HttpResponse> {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<HttpResponse> {
    return this.request(path, { ...options, method: 'POST' });
  }

  async request(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const retries = options.retries ?? this.options.retries ?? 2;
    const backoffMs = this.options.backoffMs ?? 200;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await this.sleep(backoffMs * 2 ** (attempt - 1));
      try {
        const response = await this.attempt(path, options);
        if (response.status < 500) return response;
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw new SourceUnavailableError(this.options.source, undefined, { cause: lastError });
  }

  private async attempt(path: string, options: HttpRequestOptions): Promise<HttpResponse> {
    const method = (options.method ?? 'GET').toUpperCase();
    const timeoutMs = options.timeoutMs ?? this.options.timeoutMs ?? 10_000;
    const headers: Record<string, string> = { ...this.options.headers };
    if (this.options.userAgent) headers['User-Agent'] = this.options.userAgent;
    if (options.body === undefined && BODY_METHODS.has(method)) headers['Content-Length'] = '0';
    Object.assign(headers, options.headers);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await this.fetchFn(this.resolveUrl(path), {
        method,
        headers,
        body: options.body,
        signal: controller.signal,
      });
      const text = await res.text();
      return {
        status: res.status,
        ok: res.ok,
        headers: res.headers,
        setCookies: res.headers.getSetCookie(),
        text,
        json: <T>() => JSON.parse(text) as T,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private resolveUrl(path: string): string {
    const { baseUrl } = this.options;
    if (!baseUrl) return path;
    return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  }
}
