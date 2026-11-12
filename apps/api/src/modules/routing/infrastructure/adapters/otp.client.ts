import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { type FetchFn, HttpClient } from '../../../../shared/infrastructure/http/http-client';
import { OTP_PLAN_CONNECTION_QUERY } from './otp-plan-connection.query';
import type { OtpPlanConnectionResponse } from './otp.types';

export const OTP_SOURCE = 'otp';
/** Endpoint da API GraphQL GTFS no OTP 2.x. */
export const OTP_GTFS_GRAPHQL_PATH = 'otp/gtfs/v1';

export interface OtpClientOptions {
  /** OTP_URL; sem ele, o planejamento fica indisponível. */
  baseUrl: string | undefined;
  fetch?: FetchFn;
  timeoutMs?: number;
  retries?: number;
}

export interface OtpPlanVariables {
  origin: { label: string; location: { coordinate: { latitude: number; longitude: number } } };
  destination: {
    label: string;
    location: { coordinate: { latitude: number; longitude: number } };
  };
  dateTime?: { earliestDeparture: string } | { latestArrival: string };
  first: number;
  /** Janela de saídas (Duration do OTP em ISO 8601, ex.: "PT45M"). */
  searchWindow?: string;
  /** Só estes modos de transporte (enum TransitMode do OTP). */
  modes?: { transit: { transit: Array<{ mode: string }> } };
}

/** Planejamento pesado (cidade inteira, muitas baldeações) leva vários segundos no OTP. */
export const OTP_TIMEOUT_MS = 30_000;

/**
 * Cliente GraphQL do OpenTripPlanner, uma tentativa por chamada (timeout de 30 s); a nova
 * tentativa (mesma consulta em falha de rede/5xx, consulta menor em timeout) fica no adaptador.
 */
export class OtpClient {
  private readonly http: HttpClient | null;

  constructor(options: OtpClientOptions) {
    this.http = options.baseUrl
      ? new HttpClient({
          source: OTP_SOURCE,
          baseUrl: options.baseUrl,
          timeoutMs: options.timeoutMs ?? OTP_TIMEOUT_MS,
          retries: options.retries ?? 0,
          headers: { Accept: 'application/json' },
          fetch: options.fetch,
        })
      : null;
  }

  /** Sem OTP_URL não há o que tentar de novo. */
  get isConfigured(): boolean {
    return this.http !== null;
  }

  async planConnection(variables: OtpPlanVariables): Promise<OtpPlanConnectionResponse> {
    if (!this.http) {
      throw new SourceUnavailableError(
        OTP_SOURCE,
        'O planejador de viagens não está configurado: defina OTP_URL.',
      );
    }
    const response = await this.http.post(OTP_GTFS_GRAPHQL_PATH, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: OTP_PLAN_CONNECTION_QUERY, variables }),
    });
    if (!response.ok) {
      throw new SourceUnavailableError(OTP_SOURCE, undefined, {
        cause: new Error(`HTTP ${response.status}`),
      });
    }
    try {
      return response.json<OtpPlanConnectionResponse>();
    } catch (error) {
      throw new SourceUnavailableError(OTP_SOURCE, undefined, { cause: error });
    }
  }
}
