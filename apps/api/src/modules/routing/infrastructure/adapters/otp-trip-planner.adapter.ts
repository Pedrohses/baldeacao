import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import type { Itinerary, TripMode } from '../../domain/entities/itinerary.entity';
import { TripPlanner } from '../../domain/ports/trip-planner.port';
import type { TripPlanQuery } from '../../domain/value-objects/trip-plan-query';
import { OTP_SOURCE, OtpClient, type OtpPlanVariables } from './otp.client';
import { OtpItineraryMapper } from './otp-itinerary.mapper';

export const ORIGIN_LABEL = 'Origem';
export const DESTINATION_LABEL = 'Destino';

/** Segunda tentativa depois de timeout: menos itinerários e janela de saídas menor. */
export const OTP_REDUCED_FIRST = 6;
export const OTP_REDUCED_SEARCH_WINDOW = 'PT45M';

// TripMode para os valores do enum TransitMode do OTP.
const OTP_MODES_BY_TRIP_MODE: Record<Exclude<TripMode, 'walk'>, string[]> = {
  bus: ['BUS', 'COACH'],
  trolleybus: ['TROLLEYBUS'],
  subway: ['SUBWAY', 'MONORAIL'],
  rail: ['RAIL', 'FUNICULAR'],
  tram: ['TRAM', 'CABLE_CAR', 'GONDOLA'],
  ferry: ['FERRY'],
};

/** Modos permitidos (enum do OTP) quando a consulta exclui alguns; null sem exclusão. */
export function allowedOtpModes(exclude: TripMode[] | undefined): string[] | null {
  if (!exclude || exclude.length === 0) return null;
  return (Object.keys(OTP_MODES_BY_TRIP_MODE) as Array<keyof typeof OTP_MODES_BY_TRIP_MODE>)
    .filter((mode) => !exclude.includes(mode))
    .flatMap((mode) => OTP_MODES_BY_TRIP_MODE[mode]);
}

/** A requisição estourou o tempo (AbortController do HttpClient). */
function isTimeout(error: unknown): boolean {
  if (!(error instanceof SourceUnavailableError)) return false;
  // DOMException nem sempre é instanceof Error (outro realm); basta o nome.
  const name = (error.cause as { name?: unknown } | undefined)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

export function toOtpVariables(query: TripPlanQuery): OtpPlanVariables {
  const variables: OtpPlanVariables = {
    origin: {
      label: ORIGIN_LABEL,
      location: { coordinate: { latitude: query.from.lat, longitude: query.from.lon } },
    },
    destination: {
      label: DESTINATION_LABEL,
      location: { coordinate: { latitude: query.to.lat, longitude: query.to.lon } },
    },
    first: query.candidates,
  };
  const allowed = allowedOtpModes(query.excludeModes);
  if (allowed) variables.modes = { transit: { transit: allowed.map((mode) => ({ mode })) } };
  if (query.time && 'departAt' in query.time) {
    variables.dateTime = { earliestDeparture: query.time.departAt };
  } else if (query.time && 'arriveBy' in query.time) {
    variables.dateTime = { latestArrival: query.time.arriveBy };
  }
  return variables;
}

/** TripPlanner sobre o OpenTripPlanner 2.10 (GraphQL `planConnection`). */
@Injectable()
export class OtpTripPlannerAdapter extends TripPlanner {
  constructor(private readonly client: OtpClient) {
    super();
  }

  /**
   * Uma consulta; em falha de rede ou 5xx, tenta de novo igual; em timeout (30 s), tenta de
   * novo com menos itinerários (6) e janela de 45 min antes de desistir.
   */
  async plan(query: TripPlanQuery): Promise<Itinerary[]> {
    const variables = toOtpVariables(query);
    let response;
    try {
      response = await this.client.planConnection(variables);
    } catch (error) {
      if (!(error instanceof SourceUnavailableError) || !this.client.isConfigured) throw error;
      response = await this.client.planConnection(
        isTimeout(error)
          ? {
              ...variables,
              first: Math.min(variables.first, OTP_REDUCED_FIRST),
              searchWindow: OTP_REDUCED_SEARCH_WINDOW,
            }
          : variables,
      );
    }
    const connection = response.data?.planConnection;
    if (!connection) {
      // Erro de GraphQL (schema, validação) ou OTP sem grafo carregado.
      const detail = response.errors?.map((e) => e.message).join('; ') || 'resposta sem dados';
      throw new SourceUnavailableError(OTP_SOURCE, undefined, { cause: new Error(detail) });
    }
    // routingErrors (sem conexão, fora da área, origem igual ao destino) = nenhum itinerário.
    return (connection.edges ?? [])
      .map((edge) => (edge ? OtpItineraryMapper.toDomain(edge.node) : null))
      .filter((itinerary): itinerary is Itinerary => itinerary !== null);
  }
}
