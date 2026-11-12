export const stopKeys = {
  all: ['stops'] as const,
  nearby: (lat: number, lon: number, radius: number) =>
    [...stopKeys.all, 'nearby', { lat, lon, radius }] as const,
  arrivals: (stopId: string) => [...stopKeys.all, 'arrivals', stopId] as const,
};
