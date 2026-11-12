import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PositionsUpdateSchema,
  REALTIME_EVENTS,
  positionsLineChannel,
  type PositionsUpdate,
} from '@baldeacao/types';
import { io, type Socket } from 'socket.io-client';
import {
  InMemoryCycleNotifier,
  InMemoryPositionsStore,
  rawPositionsFixture,
} from '../../../../../test/realtime/in-memory-realtime';
import { BuildChannelUpdatesUseCase } from '../../application/use-cases/build-channel-updates.use-case';
import { PositionsCycleNotifierPort } from '../../domain/ports/positions-cycle-notifier.port';
import { VehiclePositionsStorePort } from '../../domain/ports/vehicle-positions-store.port';
import { mapOlhoVivoPositions } from '../../infrastructure/adapters/olho-vivo-position.mapper';
import { PositionsGateway, WEB_ORIGIN, type SubscriptionAck } from './positions.gateway';

const FIRST = '2026-11-12T15:34:30.000Z';
const SECOND = '2026-11-12T15:35:00.000Z';

describe('PositionsGateway (Socket.IO)', () => {
  let app: INestApplication;
  let url: string;
  let store: InMemoryPositionsStore;
  let notifier: InMemoryCycleNotifier;
  const clients: Socket[] = [];

  beforeEach(async () => {
    store = new InMemoryPositionsStore();
    notifier = new InMemoryCycleNotifier();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PositionsGateway,
        BuildChannelUpdatesUseCase,
        { provide: VehiclePositionsStorePort, useValue: store },
        { provide: PositionsCycleNotifierPort, useValue: notifier },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) client.disconnect();
    await app.close();
  });

  async function connect(): Promise<Socket> {
    const client = io(url, { transports: ['websocket'], forceNew: true });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    return client;
  }

  /** Coleta positions:update validando cada payload contra o contrato. */
  function collect(client: Socket): PositionsUpdate[] {
    const received: PositionsUpdate[] = [];
    client.on(REALTIME_EVENTS.update, (payload: unknown) =>
      received.push(PositionsUpdateSchema.parse(payload)),
    );
    return received;
  }

  async function until(check: () => boolean): Promise<void> {
    const deadline = Date.now() + 3_000;
    while (!check()) {
      if (Date.now() > deadline) throw new Error('Tempo esgotado esperando evento.');
      await new Promise((r) => setTimeout(r, 20));
    }
  }

  async function cycle(updatedAt: string, count = 4): Promise<void> {
    const vehicles = mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans').slice(0, count);
    await store.replace('sptrans', vehicles, updatedAt);
    await notifier.publish({ sourceId: 'sptrans', updatedAt, vehicleCount: vehicles.length });
  }

  it('publica positions:update a cada ciclo só para quem está no canal', async () => {
    const allClient = await connect();
    const lineClient = await connect();
    const idle = await connect();
    const allUpdates = collect(allClient);
    const lineUpdates = collect(lineClient);
    const idleUpdates = collect(idle);

    const channel = positionsLineChannel('875A-10');
    await expect(
      allClient.emitWithAck(REALTIME_EVENTS.subscribe, { channel: 'positions:all' }),
    ).resolves.toEqual({ ok: true, channel: 'positions:all' } satisfies SubscriptionAck);
    await lineClient.emitWithAck(REALTIME_EVENTS.subscribe, { channel });

    await cycle(FIRST);
    await until(() => allUpdates.length === 1 && lineUpdates.length === 1);

    expect(allUpdates[0]).toMatchObject({
      channel: 'positions:all',
      routeId: null,
      updatedAt: FIRST,
    });
    expect(allUpdates[0]?.vehicles).toHaveLength(4);
    expect(lineUpdates[0]).toMatchObject({ channel, routeId: '875A-10', sourceId: 'sptrans' });
    expect(lineUpdates[0]?.vehicles.every((v) => v.routeId === '875A-10')).toBe(true);
    expect(idleUpdates).toEqual([]);
  });

  it('envia a foto atual ao entrar no canal e para de enviar após positions:unsubscribe', async () => {
    await cycle(FIRST);
    const client = await connect();
    const updates = collect(client);

    await client.emitWithAck(REALTIME_EVENTS.subscribe, { channel: 'positions:all' });
    await until(() => updates.length === 1);
    expect(updates[0]?.updatedAt).toBe(FIRST);

    await expect(
      client.emitWithAck(REALTIME_EVENTS.unsubscribe, { channel: 'positions:all' }),
    ).resolves.toEqual({ ok: true, channel: 'positions:all' });
    await cycle(SECOND);
    await new Promise((r) => setTimeout(r, 150));

    expect(updates).toHaveLength(1);
  });

  it('a foto do ciclo seguinte substitui a anterior (não é diff)', async () => {
    const client = await connect();
    const updates = collect(client);
    await client.emitWithAck(REALTIME_EVENTS.subscribe, { channel: 'positions:all' });

    await cycle(FIRST, 4);
    await cycle(SECOND, 1);
    await until(() => updates.length === 2);

    expect(updates[1]).toMatchObject({ updatedAt: SECOND });
    expect(updates[1]?.vehicles).toHaveLength(1);
  });

  it('recusa canal fora do contrato com ack de erro', async () => {
    const client = await connect();

    const ack = (await client.emitWithAck(REALTIME_EVENTS.subscribe, {
      channel: 'positions:line:875A 10',
    })) as SubscriptionAck;

    expect(ack).toMatchObject({ ok: false, error: { code: 'INVALID_CHANNEL' } });
  });

  it('libera CORS para a origem do web', async () => {
    const response = await fetch(`${url}/socket.io/?EIO=4&transport=polling`, {
      headers: { Origin: WEB_ORIGIN },
    });

    expect(response.headers.get('access-control-allow-origin')).toBe(WEB_ORIGIN);
    await response.text();
  });
});
