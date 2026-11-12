import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import type { Itinerary } from '../../domain/entities/itinerary.entity';
import { TripPlanner } from '../../domain/ports/trip-planner.port';
import type { TripPlanQuery } from '../../domain/value-objects/trip-plan-query';
import { OTP_SOURCE, OtpClient, type OtpPlanVariables } from './otp.client';
import { OtpItineraryMapper } from './otp-itinerary.mapper';

export const ORIGIN_LABEL = 'Origem';
export const DESTINATION_LABEL = 'Destino';

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

  async plan(query: TripPlanQuery): Promise<Itinerary[]> {
    const response = await this.client.planConnection(toOtpVariables(query));
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
