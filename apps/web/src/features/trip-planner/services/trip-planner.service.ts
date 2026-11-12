import {
  API_PATHS,
  PlanTripResponseSchema,
  TripRequestSchema,
  type Itinerary,
  type TripRequest,
} from '@baldeacao/types';

import { env } from '@/shared/config/env';
import { ApiError } from '@/shared/lib/api-client';

// O api-client compartilhado só tem GET; o POST de planTrip segue o mesmo contrato de erro
// (ApiError com status 0 para rede ou resposta fora do contrato).
const NETWORK_STATUS = 0;

function messageForStatus(status: number): string {
  if (status === 400 || status === 422) return 'Não foi possível planejar essa viagem.';
  if (status === 429) return 'Muitas requisições. Tente de novo em instantes.';
  if (status >= 500) return 'O planejador está com problemas. Tente de novo em instantes.';
  return 'Não foi possível concluir a requisição.';
}

export const tripPlannerService = {
  /** Planeja a viagem (OpenTripPlanner no backend) e devolve os itinerários validados. */
  async plan(request: TripRequest, init?: RequestInit): Promise<Itinerary[]> {
    const body = TripRequestSchema.parse(request);
    const url = `${env.apiUrl.replace(/\/+$/, '')}${API_PATHS.planTrip}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...init?.headers,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(NETWORK_STATUS, 'Sem conexão com o servidor. Verifique sua internet.');
    }

    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => undefined);
      throw new ApiError(response.status, messageForStatus(response.status), payload);
    }

    const json: unknown = await response.json().catch(() => undefined);
    const parsed = PlanTripResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        NETWORK_STATUS,
        'A resposta do servidor veio em um formato inesperado.',
        parsed.error.issues,
      );
    }
    return parsed.data.itineraries;
  },
};
