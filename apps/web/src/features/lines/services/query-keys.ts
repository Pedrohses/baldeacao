export const lineKeys = {
  all: ['lines'] as const,
  details: (routeId: string) => [...lineKeys.all, 'details', routeId] as const,
  search: (query: string) => [...lineKeys.all, 'search', query] as const,
};
