import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { type FetchFn, HttpClient } from '../../../../shared/infrastructure/http/http-client';
import { MinIntervalScheduler } from './min-interval-scheduler';
import type { NominatimSearchResult } from './nominatim.types';

export const NOMINATIM_SOURCE = 'nominatim';
/** Política de uso do Nominatim público: no máximo 1 requisição por segundo. */
export const NOMINATIM_MIN_INTERVAL_MS = 1000;
/** Grande São Paulo (RMSP), em lon/lat: oeste, norte, leste, sul. */
export const GREATER_SAO_PAULO_VIEWBOX = '-47.21,-23.18,-45.69,-24.07';

export interface NominatimClientOptions {
  baseUrl: string;
  /** Obrigatório pela política do Nominatim; sem ele, a busca fica indisponível. */
  userAgent: string | undefined;
  fetch?: FetchFn;
  /** Fila compartilhada do processo; o padrão é 1 req/s. */
  scheduler?: MinIntervalScheduler;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Cliente do `/search` do Nominatim: toda requisição passa pela fila de 1 req/s
 * (inclusive as novas tentativas, que esperam pelo menos 1 s entre si).
 */
export class NominatimClient {
  private readonly http: HttpClient;
  private readonly scheduler: MinIntervalScheduler;

  constructor(private readonly options: NominatimClientOptions) {
    this.http = new HttpClient({
      source: NOMINATIM_SOURCE,
      baseUrl: options.baseUrl,
      userAgent: options.userAgent,
      timeoutMs: options.timeoutMs ?? 5_000,
      retries: options.retries ?? 1,
      backoffMs: NOMINATIM_MIN_INTERVAL_MS,
      headers: { Accept: 'application/json' },
      fetch: options.fetch,
    });
    this.scheduler = options.scheduler ?? new MinIntervalScheduler(NOMINATIM_MIN_INTERVAL_MS);
  }

  async search(query: string, limit: number): Promise<NominatimSearchResult[]> {
    this.assertConfigured();
    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      viewbox: GREATER_SAO_PAULO_VIEWBOX,
      bounded: '1',
      'accept-language': 'pt-BR',
      limit: String(limit),
    });
    const body = await this.getJson(`search?${params.toString()}`);
    if (!Array.isArray(body)) {
      throw new SourceUnavailableError(NOMINATIM_SOURCE, undefined, {
        cause: new Error('Resposta do Nominatim não é uma lista'),
      });
    }
    return body as NominatimSearchResult[];
  }

  /**
   * Busca estruturada só por CEP (`postalcode`), no Brasil e na Grande SP. Não mistura com
   * `q`: o Nominatim não aceita os dois juntos.
   */
  async searchPostalCode(postalCode: string, limit: number): Promise<NominatimSearchResult[]> {
    this.assertConfigured();
    const params = new URLSearchParams({
      postalcode: postalCode,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      viewbox: GREATER_SAO_PAULO_VIEWBOX,
      bounded: '1',
      'accept-language': 'pt-BR',
      limit: String(limit),
    });
    const body = await this.getJson(`search?${params.toString()}`);
    if (!Array.isArray(body)) {
      throw new SourceUnavailableError(NOMINATIM_SOURCE, undefined, {
        cause: new Error('Resposta do Nominatim não é uma lista'),
      });
    }
    return body as NominatimSearchResult[];
  }

  /** Busca estruturada por rua (`street` e `city`), na Grande SP. */
  async searchStreet(
    street: string,
    city: string,
    limit: number,
  ): Promise<NominatimSearchResult[]> {
    this.assertConfigured();
    const params = new URLSearchParams({
      street,
      city,
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      viewbox: GREATER_SAO_PAULO_VIEWBOX,
      bounded: '1',
      'accept-language': 'pt-BR',
      limit: String(limit),
    });
    const body = await this.getJson(`search?${params.toString()}`);
    if (!Array.isArray(body)) {
      throw new SourceUnavailableError(NOMINATIM_SOURCE, undefined, {
        cause: new Error('Resposta do Nominatim não é uma lista'),
      });
    }
    return body as NominatimSearchResult[];
  }

  /**
   * `/reverse` no nível de prédio/rua (zoom 18). null quando o Nominatim não acha lugar
   * (ele responde 200 com `{ "error": "Unable to geocode" }`).
   */
  async reverse(lat: number, lon: number): Promise<NominatimSearchResult | null> {
    this.assertConfigured();
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
      'accept-language': 'pt-BR',
    });
    const body = await this.getJson(`reverse?${params.toString()}`);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new SourceUnavailableError(NOMINATIM_SOURCE, undefined, {
        cause: new Error('Resposta do reverse do Nominatim não é um objeto'),
      });
    }
    if ('error' in body) return null;
    return body as NominatimSearchResult;
  }

  private assertConfigured(): void {
    if (!this.options.userAgent?.trim()) {
      throw new SourceUnavailableError(
        NOMINATIM_SOURCE,
        'A busca de lugares está desativada: configure NOMINATIM_USER_AGENT.',
      );
    }
  }

  /** GET pela fila de 1 req/s; HTTP de erro ou JSON inválido viram SourceUnavailableError. */
  private async getJson(path: string): Promise<unknown> {
    const response = await this.scheduler.schedule(() => this.http.get(path));
    if (!response.ok) {
      throw new SourceUnavailableError(NOMINATIM_SOURCE, undefined, {
        cause: new Error(`HTTP ${response.status}`),
      });
    }
    try {
      return response.json();
    } catch (error) {
      throw new SourceUnavailableError(NOMINATIM_SOURCE, undefined, { cause: error });
    }
  }
}
