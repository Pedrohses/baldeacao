import { OlhoVivoAuthError } from '../../domain/errors/olho-vivo-auth.error';
import { SourceUnavailableError } from '../../domain/errors/source-unavailable.error';
import { HttpClient, type FetchFn, type HttpResponse } from '../http/http-client';
import type { OlhoVivoRawPositions } from './olho-vivo.types';

export const OLHO_VIVO_BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1/';
const SOURCE = 'olho-vivo';
const COOKIE_NAME = 'apiCredentials';

export interface OlhoVivoClientOptions {
  token: string | undefined;
  userAgent: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  fetch?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
}

export class OlhoVivoClient {
  private readonly http: HttpClient;
  private credentials: string | undefined;
  private loginPromise: Promise<string> | undefined;

  constructor(private readonly options: OlhoVivoClientOptions) {
    this.http = new HttpClient({
      source: SOURCE,
      baseUrl: options.baseUrl ?? OLHO_VIVO_BASE_URL,
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs ?? 10_000,
      retries: options.retries ?? 2,
      fetch: options.fetch,
      sleep: options.sleep,
    });
  }

  /** GET with session cookie; on 401 logs in again once and repeats the call. */
  async get<T>(path: string, query?: Record<string, string | number>): Promise<T> {
    const url = buildPath(path, query);
    let response = await this.http.get(url, { headers: { Cookie: await this.getCredentials() } });
    if (response.status === 401) {
      this.credentials = undefined;
      response = await this.http.get(url, { headers: { Cookie: await this.getCredentials() } });
    }
    if (!response.ok) {
      throw new SourceUnavailableError(SOURCE, undefined, {
        cause: new Error(`HTTP ${response.status}`),
      });
    }
    return response.json<T>();
  }

  getPositions(): Promise<OlhoVivoRawPositions> {
    return this.get<OlhoVivoRawPositions>('Posicao');
  }

  private getCredentials(): Promise<string> {
    if (this.credentials) return Promise.resolve(this.credentials);
    this.loginPromise ??= this.login().finally(() => {
      this.loginPromise = undefined;
    });
    return this.loginPromise;
  }

  private async login(): Promise<string> {
    const { token } = this.options;
    if (!token) throw new OlhoVivoAuthError('OLHOVIVO_TOKEN não configurado.');

    const response = await this.http.post(`Login/Autenticar?token=${encodeURIComponent(token)}`);
    const cookie = extractCredentials(response);
    if (!response.ok || response.text.trim() !== 'true' || !cookie) {
      throw new OlhoVivoAuthError();
    }
    this.credentials = cookie;
    return cookie;
  }
}

function extractCredentials(response: HttpResponse): string | undefined {
  for (const setCookie of response.setCookies) {
    const pair = setCookie.split(';')[0]?.trim();
    if (pair?.startsWith(`${COOKIE_NAME}=`)) return pair;
  }
  return undefined;
}

function buildPath(path: string, query?: Record<string, string | number>): string {
  const clean = path.replace(/^\/+/, '');
  if (!query || Object.keys(query).length === 0) return clean;
  const params = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  return `${clean}${clean.includes('?') ? '&' : '?'}${params.toString()}`;
}
