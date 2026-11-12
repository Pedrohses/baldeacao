export type RouteType = 'bus' | 'trolleybus' | 'subway' | 'rail' | 'tram' | 'ferry';

export type DirectionId = 0 | 1;

/**
 * route_type do GTFS (básico 0 a 12 e estendido 100 a 1700) para o tipo do app.
 * Tipos sem equivalente (teleférico, funicular, táxi) caem em "bus".
 */
export function routeTypeFromGtfs(code: number): RouteType {
  switch (code) {
    case 0:
      return 'tram';
    case 1:
      return 'subway';
    case 2:
      return 'rail';
    case 4:
      return 'ferry';
    case 11:
      return 'trolleybus';
  }
  if (code >= 100 && code < 200) return 'rail';
  if (code >= 400 && code < 500) return 'subway';
  if (code === 800) return 'trolleybus';
  if (code >= 900 && code < 1000) return 'tram';
  if (code === 1000 || code === 1200) return 'ferry';
  return 'bus';
}
