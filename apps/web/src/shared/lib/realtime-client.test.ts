// @vitest-environment node
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  type ClientToServerEvents,
  POSITIONS_ALL_CHANNEL,
  type PositionsUpdate,
  REALTIME_EVENTS,
  type ServerToClientEvents,
  positionsLineChannel,
} from '@baldeacao/types';
import { Server } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createRealtimeClient, type RealtimeClient } from './realtime-client';

type TestServer = Server<ClientToServerEvents, ServerToClientEvents>;

const line = positionsLineChannel('8000-10');

function update(channel: PositionsUpdate['channel']): PositionsUpdate {
  return {
    channel,
    sourceId: 'sptrans',
    routeId: '8000-10',
    updatedAt: '2026-01-01T12:00:00.000Z',
    vehicles: [
      {
        vehicleId: '11001',
        sourceId: 'sptrans',
        routeId: '8000-10',
        routeShortName: '8000-10',
        directionId: 0,
        location: { lat: -23.55, lon: -46.63 },
        accessible: true,
        recordedAt: '2026-01-01T12:00:00.000Z',
      },
    ],
  };
}

function until<T>(check: () => T | undefined, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const value = check();
      if (value !== undefined) return resolve(value);
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('realtime-client', () => {
  let http: HttpServer;
  let server: TestServer;
  let client: RealtimeClient;
  let subscribes: string[];
  let unsubscribes: string[];

  beforeEach(async () => {
    subscribes = [];
    unsubscribes = [];
    http = createServer();
    server = new Server(http);
    server.on('connection', (socket) => {
      socket.on(REALTIME_EVENTS.subscribe, ({ channel }) => {
        subscribes.push(channel);
        void socket.join(channel);
      });
      socket.on(REALTIME_EVENTS.unsubscribe, ({ channel }) => {
        unsubscribes.push(channel);
        void socket.leave(channel);
      });
    });
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const { port } = http.address() as AddressInfo;
    client = createRealtimeClient({
      url: `http://127.0.0.1:${port}`,
      socketOptions: { transports: ['websocket'], reconnectionDelay: 20, reconnectionDelayMax: 50 },
    });
  });

  afterEach(async () => {
    client.disconnect();
    await server.close();
  });

  it('entrega update válido ao callback', async () => {
    const received: PositionsUpdate[] = [];
    client.subscribePositions(line, (u) => received.push(u));
    await until(() => (subscribes.includes(line) ? true : undefined));

    server.to(line).emit(REALTIME_EVENTS.update, update(line));
    const first = await until(() => received[0]);
    expect(first.vehicles[0]?.vehicleId).toBe('11001');
  });

  it('descarta payload inválido e segue entregando os válidos', async () => {
    const received: PositionsUpdate[] = [];
    client.subscribePositions(POSITIONS_ALL_CHANNEL, (u) => received.push(u));
    await until(() => (subscribes.length > 0 ? true : undefined));

    const invalid = { ...update(POSITIONS_ALL_CHANNEL), vehicles: [{ vehicleId: 1 }] };
    server
      .to(POSITIONS_ALL_CHANNEL)
      .emit(REALTIME_EVENTS.update, invalid as unknown as PositionsUpdate);
    server.to(POSITIONS_ALL_CHANNEL).emit(REALTIME_EVENTS.update, update(POSITIONS_ALL_CHANNEL));

    await until(() => received[0]);
    expect(received).toHaveLength(1);
    expect(received[0]?.vehicles).toHaveLength(1);
  });

  it('reassina os canais ativos após reconexão', async () => {
    const received: PositionsUpdate[] = [];
    client.subscribePositions(line, (u) => received.push(u));
    await until(() => (subscribes.length === 1 ? true : undefined));

    // Derruba o transporte (não o namespace): o cliente reconecta sozinho.
    for (const s of server.sockets.sockets.values()) s.conn.close();
    await until(() => (subscribes.length === 2 ? true : undefined));
    expect(subscribes).toEqual([line, line]);

    server.to(line).emit(REALTIME_EVENTS.update, update(line));
    await until(() => received[0]);
  });

  it('emite unsubscribe só ao cancelar a última assinatura do canal', async () => {
    const offA = client.subscribePositions(line, () => undefined);
    const offB = client.subscribePositions(line, () => undefined);
    await until(() => (subscribes.length > 0 ? true : undefined));
    expect(subscribes).toEqual([line]);

    offA();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(unsubscribes).toEqual([]);

    offB();
    await until(() => (unsubscribes.length > 0 ? true : undefined));
    expect(unsubscribes).toEqual([line]);
  });
});
