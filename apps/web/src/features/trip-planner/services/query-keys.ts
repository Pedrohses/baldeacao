import type { TripRequest } from '@baldeacao/types';

export const tripKeys = {
  all: ['trips'] as const,
  plan: (request: TripRequest) => [...tripKeys.all, 'plan', request] as const,
};
