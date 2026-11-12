export const vehicleKeys = {
  all: ['vehicles'] as const,
  positions: (routeId?: string) => [...vehicleKeys.all, 'positions', routeId ?? 'all'] as const,
};
