// Adaptadores em memória das portas do transit, para testes de caso de uso e de controller.
// Dados alinhados ao recorte sptrans-mini (mesmos ids e coordenadas).
import { LineShape } from '../../src/modules/transit/domain/entities/line-shape.entity';
import { Route } from '../../src/modules/transit/domain/entities/route.entity';
import {
  type NearbyStop,
  Stop,
  type StopNameMatch,
} from '../../src/modules/transit/domain/entities/stop.entity';
import { RouteRepository } from '../../src/modules/transit/domain/ports/route-repository.port';
import {
  ServiceCalendarRepository,
  type ServicePeriod,
} from '../../src/modules/transit/domain/ports/service-calendar.port';
import { StopRepository } from '../../src/modules/transit/domain/ports/stop-repository.port';
import type { Coordinates } from '../../src/modules/transit/domain/value-objects/coordinates';

export const route875A = new Route({
  id: '875A-10',
  sourceId: 'sptrans',
  shortName: '875A-10',
  longName: 'Perdizes - Aeroporto',
  type: 'bus',
  color: '509E2F',
  textColor: 'FFFFFF',
});

export const route8000 = new Route({
  id: '8000-10',
  sourceId: 'sptrans',
  shortName: '8000-10',
  longName: 'Term. Pq. D. Pedro II - Jd. Angela',
  type: 'bus',
  color: '0072BC',
  textColor: 'FFFFFF',
});

export const shape875A0 = new LineShape({
  routeId: '875A-10',
  sourceId: 'sptrans',
  directionId: 0,
  shapeId: '84609',
  points: [
    { lat: -23.535, lon: -46.675 },
    { lat: -23.5455, lon: -46.6685 },
  ],
});

export const stopPaulista = new Stop({
  id: '4301848',
  sourceId: 'sptrans',
  code: null,
  name: 'Av. Paulista 1578',
  description: 'Em frente ao MASP',
  location: { lat: -23.5614, lon: -46.6559 },
});

export const stopLiberdade = new Stop({
  id: '4200961',
  sourceId: 'sptrans',
  code: null,
  name: 'Av. Liberdade 400',
  description: 'Proximo ao metro Liberdade',
  location: { lat: -23.5565, lon: -46.6355 },
});

export class InMemoryRouteRepository extends RouteRepository {
  readonly calls: Array<{ text: string; limit: number }> = [];

  constructor(
    private readonly routes: Route[] = [route875A, route8000],
    private readonly shapes: LineShape[] = [shape875A0],
  ) {
    super();
  }

  search(text: string, limit: number): Promise<Route[]> {
    this.calls.push({ text, limit });
    const needle = text.toLowerCase();
    const found = this.routes.filter(
      (r) =>
        r.shortName.toLowerCase().includes(needle) || r.longName.toLowerCase().includes(needle),
    );
    return Promise.resolve(found.slice(0, limit));
  }

  findById(routeId: string): Promise<Route | null> {
    return Promise.resolve(this.routes.find((r) => r.id === routeId) ?? null);
  }

  findShapes(route: Route): Promise<LineShape[]> {
    return Promise.resolve(
      this.shapes.filter((s) => s.routeId === route.id && s.sourceId === route.sourceId),
    );
  }
}

export class InMemoryStopRepository extends StopRepository {
  constructor(private readonly stops: Stop[] = [stopPaulista, stopLiberdade]) {
    super();
  }

  findNearby(center: Coordinates, radiusM: number, limit: number): Promise<NearbyStop[]> {
    const found = this.stops
      .map((stop) => ({ stop, distanceM: Math.round(haversineM(center, stop.location)) }))
      .filter((s) => s.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, limit);
    return Promise.resolve(found);
  }

  findNearestStation(center: Coordinates, radiusM: number): Promise<NearbyStop | null> {
    const found = this.stops
      .filter((stop) => this.stationIds.has(stop.id))
      .map((stop) => ({ stop, distanceM: Math.round(haversineM(center, stop.location)) }))
      .filter((s) => s.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM);
    return Promise.resolve(found[0] ?? null);
  }

  exists(stopId: string): Promise<boolean> {
    return Promise.resolve(this.stops.some((stop) => stop.id === stopId));
  }

  existsWithin(center: Coordinates, radiusM: number): Promise<boolean> {
    return Promise.resolve(this.stops.some((stop) => haversineM(center, stop.location) <= radiusM));
  }

  readonly searchCalls: Array<{ text: string; limit: number }> = [];

  /** Ids tratados como estação de metrô ou trem. */
  readonly stationIds = new Set<string>();

  searchByName(text: string, limit: number): Promise<StopNameMatch[]> {
    this.searchCalls.push({ text, limit });
    const fold = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
    const needle = fold(text);
    const found = this.stops
      .filter((s) => fold(s.name).includes(needle))
      .sort((a, b) => a.name.length - b.name.length)
      .map((stop) => ({ stop, isStation: this.stationIds.has(stop.id) }));
    return Promise.resolve(found.slice(0, limit));
  }
}

/** Distância em metros na esfera; só para o adaptador de teste (produção usa PostGIS). */
export function haversineM(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}

/** Calendário em memória; padrão: o ano de 2026 inteiro (como a fixture sptrans-mini). */
export class InMemoryServiceCalendar extends ServiceCalendarRepository {
  constructor(
    private readonly period: ServicePeriod | null = {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
  ) {
    super();
  }

  servicePeriod(): Promise<ServicePeriod | null> {
    return Promise.resolve(this.period);
  }
}
