import type { Arrival } from '@baldeacao/types';

export interface NearbyLine {
  routeId: string;
  routeShortName: string;
  routeColor: string | null;
  routeTextColor: string | null;
  headsign: string | null;
  /** Próxima chegada dessa linha em qualquer das paradas consideradas. */
  next: Arrival;
}

/**
 * Linhas distintas (por linha e sentido) das chegadas de várias paradas, da próxima chegada para
 * a mais distante, até `limit`.
 */
export function nearbyLinesFrom(arrivals: readonly Arrival[], limit: number): NearbyLine[] {
  const byLine = new Map<string, Arrival>();
  for (const arrival of arrivals) {
    const key = `${arrival.routeId}:${arrival.directionId}`;
    const current = byLine.get(key);
    if (!current || Date.parse(arrival.expectedAt) < Date.parse(current.expectedAt)) {
      byLine.set(key, arrival);
    }
  }
  return [...byLine.values()]
    .sort((a, b) => Date.parse(a.expectedAt) - Date.parse(b.expectedAt))
    .slice(0, limit)
    .map((next) => ({
      routeId: next.routeId,
      routeShortName: next.routeShortName,
      routeColor: next.routeColor,
      routeTextColor: next.routeTextColor,
      headsign: next.headsign,
      next,
    }));
}
