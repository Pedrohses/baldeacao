import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpModule } from '../../src/mcp/mcp.module';
import { SearchStopsByNameUseCase } from '../../src/modules/transit/application/use-cases/search-stops-by-name.use-case';
import { SearchPlacesUseCase } from '../../src/modules/geocoding/application/use-cases/search-places.use-case';
import type { Place } from '../../src/modules/geocoding/domain/entities/place.entity';
import { GeocodeCache } from '../../src/modules/geocoding/domain/ports/geocode-cache.port';
import { Geocoder } from '../../src/modules/geocoding/domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../src/modules/geocoding/domain/ports/known-place-repository.port';
import { GeocodingModule } from '../../src/modules/geocoding/geocoding.module';
import { PlanTripUseCase } from '../../src/modules/routing/application/use-cases/plan-trip.use-case';
import type { Itinerary } from '../../src/modules/routing/domain/entities/itinerary.entity';
import { Clock } from '../../src/modules/routing/domain/ports/clock.port';
import { TripPlanner } from '../../src/modules/routing/domain/ports/trip-planner.port';
import type { TripPlanQuery } from '../../src/modules/routing/domain/value-objects/trip-plan-query';
import { RoutingModule } from '../../src/modules/routing/routing.module';
import { GetVehicleSnapshotUseCase } from '../../src/modules/realtime/application/use-cases/get-vehicle-snapshot.use-case';
import { VehiclePositionsStorePort } from '../../src/modules/realtime/domain/ports/vehicle-positions-store.port';
import { RealtimeModule } from '../../src/modules/realtime/realtime.module';
import { FindNearbyStopsUseCase } from '../../src/modules/transit/application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from '../../src/modules/transit/application/use-cases/get-line-details.use-case';
import { GetStopArrivalsUseCase } from '../../src/modules/transit/application/use-cases/get-stop-arrivals.use-case';
import { GetServicePeriodUseCase } from '../../src/modules/transit/application/use-cases/get-service-period.use-case';
import { HasNearbyStopUseCase } from '../../src/modules/transit/application/use-cases/has-nearby-stop.use-case';
import { SearchLinesUseCase } from '../../src/modules/transit/application/use-cases/search-lines.use-case';
import type { Arrival } from '../../src/modules/transit/domain/entities/arrival.entity';
import { ArrivalsCache } from '../../src/modules/transit/domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from '../../src/modules/transit/domain/ports/arrivals-provider.port';
import { RouteRepository } from '../../src/modules/transit/domain/ports/route-repository.port';
import { ServiceCalendarRepository } from '../../src/modules/transit/domain/ports/service-calendar.port';
import { StopRepository } from '../../src/modules/transit/domain/ports/stop-repository.port';
import { TransitModule } from '../../src/modules/transit/transit.module';
import { InMemoryPositionsStore } from '../realtime/in-memory-realtime';
import { FixedClock } from '../support/routing-in-memory';
import { InMemoryGeocodeCache, InMemoryKnownPlaceRepository } from '../support/geocoding-in-memory';
import {
  InMemoryRouteRepository,
  InMemoryServiceCalendar,
  InMemoryStopRepository,
} from '../support/transit-in-memory';

/** Previsões por parada; uma parada mapeada para Error faz a fonte falhar. */
export class InMemoryArrivalsProvider extends ArrivalsProvider {
  readonly byStop = new Map<string, Arrival[] | Error>();

  forStop(stopId: string): Promise<Arrival[]> {
    const result = this.byStop.get(stopId) ?? [];
    return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
  }
}

class NoopArrivalsCache extends ArrivalsCache {
  get(): Promise<Arrival[] | null> {
    return Promise.resolve(null);
  }
  set(): Promise<void> {
    return Promise.resolve();
  }
}

/** Store de posições que pode simular o Redis fora do ar. */
export class FlakyPositionsStore extends InMemoryPositionsStore {
  failWith: Error | null = null;

  override read(sourceId: string) {
    return this.failWith ? Promise.reject(this.failWith) : super.read(sourceId);
  }
}

/** Geocodificador falso: o primeiro termo cadastrado contido na consulta decide o resultado. */
export class InMemoryGeocoder extends Geocoder {
  readonly byTerm = new Map<string, Place[] | Error>();
  readonly queries: string[] = [];

  search(query: string, limit: number): Promise<Place[]> {
    this.queries.push(query);
    for (const [term, result] of this.byTerm) {
      if (!query.includes(term)) continue;
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result.slice(0, limit));
    }
    return Promise.resolve([]);
  }

  reverse(): Promise<Place | null> {
    return Promise.resolve(null);
  }
}

/** Planejador falso com resultado trocável e registro das consultas. */
export class ControllableTripPlanner extends TripPlanner {
  result: Itinerary[] | Error = [];
  readonly queries: TripPlanQuery[] = [];

  plan(query: TripPlanQuery): Promise<Itinerary[]> {
    this.queries.push(query);
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

/** Paradas do transit com área de atendimento controlável (pontos fora do raio de propósito). */
export class ServiceAreaStopRepository extends InMemoryStopRepository {
  /** Coordenadas ("lat,lon") tratadas como sem parada perto. */
  readonly outside = new Set<string>();

  override existsWithin(center: { lat: number; lon: number }): Promise<boolean> {
    return Promise.resolve(!this.outside.has(`${center.lat},${center.lon}`));
  }
}

export interface McpFakes {
  arrivals: InMemoryArrivalsProvider;
  positions: FlakyPositionsStore;
  geocoder: InMemoryGeocoder;
  geocodeCache: InMemoryGeocodeCache;
  planner: ControllableTripPlanner;
  stops: ServiceAreaStopRepository;
}

/** Monta o McpModule real com os módulos de contexto trocados por versões em memória. */
function buildTestingModule(fakes: McpFakes) {
  @Module({
    providers: [
      SearchLinesUseCase,
      GetLineDetailsUseCase,
      FindNearbyStopsUseCase,
      GetStopArrivalsUseCase,
      SearchStopsByNameUseCase,
      HasNearbyStopUseCase,
      { provide: RouteRepository, useValue: new InMemoryRouteRepository() },
      { provide: StopRepository, useValue: fakes.stops },
      { provide: ArrivalsProvider, useValue: fakes.arrivals },
      { provide: ArrivalsCache, useValue: new NoopArrivalsCache() },
    ],
    exports: [
      SearchLinesUseCase,
      GetLineDetailsUseCase,
      FindNearbyStopsUseCase,
      GetStopArrivalsUseCase,
      SearchStopsByNameUseCase,
      HasNearbyStopUseCase,
    ],
  })
  class FakeTransitModule {}

  @Module({
    providers: [
      GetVehicleSnapshotUseCase,
      { provide: VehiclePositionsStorePort, useValue: fakes.positions },
    ],
    exports: [GetVehicleSnapshotUseCase],
  })
  class FakeRealtimeModule {}

  @Module({
    providers: [
      SearchPlacesUseCase,
      SearchStopsByNameUseCase,
      FindNearbyStopsUseCase,
      { provide: StopRepository, useValue: new InMemoryStopRepository() },
      { provide: Geocoder, useValue: fakes.geocoder },
      { provide: GeocodeCache, useValue: fakes.geocodeCache },
      { provide: KnownPlaceRepository, useValue: new InMemoryKnownPlaceRepository() },
    ],
    exports: [SearchPlacesUseCase],
  })
  class FakeGeocodingModule {}

  @Module({
    providers: [
      PlanTripUseCase,
      HasNearbyStopUseCase,
      GetServicePeriodUseCase,
      { provide: StopRepository, useValue: fakes.stops },
      { provide: TripPlanner, useValue: fakes.planner },
      { provide: ServiceCalendarRepository, useValue: new InMemoryServiceCalendar() },
      // Relógio parado antes das datas das fixtures (12/11/2026 às 07:00).
      { provide: Clock, useValue: new FixedClock() },
    ],
    exports: [PlanTripUseCase],
  })
  class FakeRoutingModule {}

  return Test.createTestingModule({ imports: [McpModule] })
    .overrideModule(GeocodingModule)
    .useModule(FakeGeocodingModule)
    .overrideModule(RoutingModule)
    .useModule(FakeRoutingModule)
    .overrideModule(TransitModule)
    .useModule(FakeTransitModule)
    .overrideModule(RealtimeModule)
    .useModule(FakeRealtimeModule);
}

/** Sobe a app de teste numa porta efêmera e devolve a URL do /mcp. */
export async function startMcpApp(): Promise<{
  app: INestApplication;
  url: URL;
  fakes: McpFakes;
}> {
  const fakes: McpFakes = {
    arrivals: new InMemoryArrivalsProvider(),
    positions: new FlakyPositionsStore(),
    geocoder: new InMemoryGeocoder(),
    geocodeCache: new InMemoryGeocodeCache(),
    planner: new ControllableTripPlanner(),
    stops: new ServiceAreaStopRepository(),
  };
  const moduleRef = await buildTestingModule(fakes).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const address = server.address() as AddressInfo;
  return { app, url: new URL(`http://127.0.0.1:${address.port}/mcp`), fakes };
}

/** Cliente MCP oficial do SDK conectado por Streamable HTTP. */
export async function connectClient(url: URL): Promise<Client> {
  const client = new Client({ name: 'baldeacao-teste', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

/** POST JSON-RPC cru, para testar o que o cliente do SDK esconde (status HTTP, cabeçalhos). */
export function rawPost(url: URL, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
