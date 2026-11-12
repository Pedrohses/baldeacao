import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpModule } from '../../src/mcp/mcp.module';
import { GetVehicleSnapshotUseCase } from '../../src/modules/realtime/application/use-cases/get-vehicle-snapshot.use-case';
import { VehiclePositionsStorePort } from '../../src/modules/realtime/domain/ports/vehicle-positions-store.port';
import { RealtimeModule } from '../../src/modules/realtime/realtime.module';
import { FindNearbyStopsUseCase } from '../../src/modules/transit/application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from '../../src/modules/transit/application/use-cases/get-line-details.use-case';
import { GetStopArrivalsUseCase } from '../../src/modules/transit/application/use-cases/get-stop-arrivals.use-case';
import { SearchLinesUseCase } from '../../src/modules/transit/application/use-cases/search-lines.use-case';
import type { Arrival } from '../../src/modules/transit/domain/entities/arrival.entity';
import { ArrivalsCache } from '../../src/modules/transit/domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from '../../src/modules/transit/domain/ports/arrivals-provider.port';
import { RouteRepository } from '../../src/modules/transit/domain/ports/route-repository.port';
import { StopRepository } from '../../src/modules/transit/domain/ports/stop-repository.port';
import { TransitModule } from '../../src/modules/transit/transit.module';
import { InMemoryPositionsStore } from '../realtime/in-memory-realtime';
import { InMemoryRouteRepository, InMemoryStopRepository } from '../support/transit-in-memory';

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

export interface McpFakes {
  arrivals: InMemoryArrivalsProvider;
  positions: FlakyPositionsStore;
}

/** Monta o McpModule real com TransitModule e RealtimeModule trocados por versões em memória. */
function buildTestingModule(fakes: McpFakes) {
  @Module({
    providers: [
      SearchLinesUseCase,
      GetLineDetailsUseCase,
      FindNearbyStopsUseCase,
      GetStopArrivalsUseCase,
      { provide: RouteRepository, useValue: new InMemoryRouteRepository() },
      { provide: StopRepository, useValue: new InMemoryStopRepository() },
      { provide: ArrivalsProvider, useValue: fakes.arrivals },
      { provide: ArrivalsCache, useValue: new NoopArrivalsCache() },
    ],
    exports: [
      SearchLinesUseCase,
      GetLineDetailsUseCase,
      FindNearbyStopsUseCase,
      GetStopArrivalsUseCase,
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

  return Test.createTestingModule({ imports: [McpModule] })
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
