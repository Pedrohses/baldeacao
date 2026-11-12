import {
  API_PATHS,
  PlanTripResponseSchema,
  TripRequestSchema,
  type Itinerary,
  type TripRequest,
} from '@baldeacao/types';

import { apiPost } from '@/shared/lib/api-client';

export const tripPlannerService = {
  /** Planeja a viagem (OpenTripPlanner no backend) e devolve os itinerários validados. */
  async plan(request: TripRequest, init?: RequestInit): Promise<Itinerary[]> {
    const body = TripRequestSchema.parse(request);
    const response = await apiPost(API_PATHS.planTrip, body, PlanTripResponseSchema, init);
    return response.itineraries;
  },
};
