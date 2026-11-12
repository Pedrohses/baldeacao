import {
  API_PATHS,
  PlanTripResponseSchema,
  TripRequestSchema,
  type Itinerary,
  type PlanTripNotice,
  type TripRequest,
} from '@baldeacao/types';

import { apiPost } from '@/shared/lib/api-client';

export interface TripPlanResult {
  itineraries: Itinerary[];
  /** Motivos de uma resposta vazia ou limitada (ex.: destino fora da área atendida). */
  notices: PlanTripNotice[];
}

export const tripPlannerService = {
  /** Planeja a viagem (OpenTripPlanner no backend) e devolve os itinerários validados. */
  async plan(request: TripRequest, init?: RequestInit): Promise<TripPlanResult> {
    const body = TripRequestSchema.parse(request);
    const response = await apiPost(API_PATHS.planTrip, body, PlanTripResponseSchema, init);
    return { itineraries: response.itineraries, notices: response.notices ?? [] };
  },
};
