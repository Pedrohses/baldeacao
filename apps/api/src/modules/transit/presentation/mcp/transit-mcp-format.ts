import type { RouteType } from '../../domain/value-objects/route-type';

const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  bus: 'ônibus',
  trolleybus: 'trólebus',
  subway: 'metrô',
  rail: 'trem',
  tram: 'VLT',
  ferry: 'balsa',
};

export function routeTypeLabel(type: RouteType): string {
  return ROUTE_TYPE_LABELS[type];
}
