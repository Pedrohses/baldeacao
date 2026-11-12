import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayInit,
} from '@nestjs/websockets';
import {
  PositionsChannelSchema,
  PositionsSubscriptionSchema,
  REALTIME_EVENTS,
  type ApiErrorBody,
  type ClientToServerEvents,
  type PositionsChannel,
  type ServerToClientEvents,
} from '@baldeacao/types';
import type { Server, Socket } from 'socket.io';
import { BuildChannelUpdatesUseCase } from '../../application/use-cases/build-channel-updates.use-case';
import {
  PositionsCycleNotifierPort,
  type PositionsCycleEvent,
} from '../../domain/ports/positions-cycle-notifier.port';
import { DEFAULT_REALTIME_SOURCE_ID } from '../../domain/realtime-source';

/** Resposta opcional (ack) de positions:subscribe e positions:unsubscribe. */
export type SubscriptionAck =
  { ok: true; channel: PositionsChannel } | { ok: false; error: ApiErrorBody };

type PositionsServer = Server<ClientToServerEvents, ServerToClientEvents>;
type PositionsSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Canais são salas do Socket.IO. A cada ciclo do worker (pub/sub positions:{source}) publica
 * positions:update com a foto completa de cada canal que tem alguém ouvindo.
 */
// CORS vem do CorsIoAdapter (WEB_ORIGIN), ligado em shared/presentation/configure-app.ts.
@WebSocketGateway()
export class PositionsGateway implements OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger(PositionsGateway.name);
  private unsubscribeCycles: (() => Promise<void>) | undefined;

  @WebSocketServer()
  server: PositionsServer;

  constructor(
    private readonly notifier: PositionsCycleNotifierPort,
    private readonly buildUpdates: BuildChannelUpdatesUseCase,
  ) {}

  async afterInit(): Promise<void> {
    this.unsubscribeCycles = await this.notifier.subscribe((event) => void this.onCycle(event));
  }

  async onModuleDestroy(): Promise<void> {
    await this.unsubscribeCycles?.();
    this.unsubscribeCycles = undefined;
  }

  @SubscribeMessage(REALTIME_EVENTS.subscribe)
  async subscribe(
    @ConnectedSocket() client: PositionsSocket,
    @MessageBody() body: unknown,
  ): Promise<SubscriptionAck> {
    const parsed = PositionsSubscriptionSchema.safeParse(body);
    if (!parsed.success) return invalidChannel();
    const { channel } = parsed.data;
    await client.join(channel);

    // Quem acabou de entrar recebe a foto atual em vez de esperar o próximo ciclo.
    const [current] = await this.buildUpdates.execute({
      sourceId: DEFAULT_REALTIME_SOURCE_ID,
      channels: [channel],
    });
    if (current) client.emit(REALTIME_EVENTS.update, current);
    return { ok: true, channel };
  }

  @SubscribeMessage(REALTIME_EVENTS.unsubscribe)
  async unsubscribe(
    @ConnectedSocket() client: PositionsSocket,
    @MessageBody() body: unknown,
  ): Promise<SubscriptionAck> {
    const parsed = PositionsSubscriptionSchema.safeParse(body);
    if (!parsed.success) return invalidChannel();
    await client.leave(parsed.data.channel);
    return { ok: true, channel: parsed.data.channel };
  }

  private async onCycle({ sourceId }: PositionsCycleEvent): Promise<void> {
    try {
      const updates = await this.buildUpdates.execute({
        sourceId,
        channels: this.activeChannels(),
      });
      for (const update of updates)
        this.server.to(update.channel).emit(REALTIME_EVENTS.update, update);
    } catch (error) {
      this.logger.warn(
        `Falha ao publicar positions:update: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Salas com pelo menos um cliente que são canais do contrato (ignora as salas por socket). */
  private activeChannels(): PositionsChannel[] {
    const channels: PositionsChannel[] = [];
    for (const [room, members] of this.server.sockets.adapter.rooms) {
      if (members.size === 0) continue;
      const parsed = PositionsChannelSchema.safeParse(room);
      if (parsed.success) channels.push(parsed.data);
    }
    return channels;
  }
}

function invalidChannel(): SubscriptionAck {
  return {
    ok: false,
    error: {
      code: 'INVALID_CHANNEL',
      message: 'Canal inválido. Use positions:all ou positions:line:<código da linha>.',
    },
  };
}
