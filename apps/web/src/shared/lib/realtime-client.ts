import {
  type ClientToServerEvents,
  type PositionsChannel,
  type PositionsUpdate,
  PositionsUpdateSchema,
  REALTIME_EVENTS,
  type ServerToClientEvents,
} from '@baldeacao/types';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';

import { env } from '@/shared/config/env';

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type PositionsListener = (update: PositionsUpdate) => void;

export interface RealtimeClientOptions {
  url: string;
  socketOptions?: Partial<ManagerOptions & SocketOptions>;
}

export interface RealtimeClient {
  /** Assina um canal; devolve a função que cancela a assinatura. */
  subscribePositions(channel: PositionsChannel, onUpdate: PositionsListener): () => void;
  /** Fecha a conexão e descarta todas as assinaturas. */
  disconnect(): void;
}

// Conexão lazy: o socket só é criado na primeira assinatura.
export function createRealtimeClient({
  url,
  socketOptions,
}: RealtimeClientOptions): RealtimeClient {
  const listeners = new Map<PositionsChannel, Set<PositionsListener>>();
  let socket: RealtimeSocket | null = null;

  function getSocket(): RealtimeSocket {
    if (socket) return socket;
    const created: RealtimeSocket = io(url, {
      autoConnect: false,
      // Direto por WebSocket: o polling inicial do Engine.IO repetia requisições à toa.
      transports: ['websocket'],
      ...socketOptions,
    });

    // O servidor perde as salas ao reconectar: reassina os canais ativos.
    created.on('connect', () => {
      for (const channel of listeners.keys()) {
        created.emit(REALTIME_EVENTS.subscribe, { channel });
      }
    });

    created.on(REALTIME_EVENTS.update, (payload) => {
      const parsed = PositionsUpdateSchema.safeParse(payload);
      if (!parsed.success) return; // payload fora do contrato é descartado
      const channelListeners = listeners.get(parsed.data.channel);
      if (!channelListeners) return;
      for (const listener of [...channelListeners]) listener(parsed.data);
    });

    socket = created;
    return created;
  }

  return {
    subscribePositions(channel, onUpdate) {
      const active = getSocket();
      let channelListeners = listeners.get(channel);
      const isFirst = !channelListeners;
      if (!channelListeners) {
        channelListeners = new Set();
        listeners.set(channel, channelListeners);
      }
      // Wrapper garante cancelamento independente mesmo com o mesmo callback repetido.
      const entry: PositionsListener = (update) => onUpdate(update);
      channelListeners.add(entry);

      if (active.connected) {
        if (isFirst) active.emit(REALTIME_EVENTS.subscribe, { channel });
      } else {
        active.connect(); // o handler de 'connect' emite as assinaturas
      }

      let cancelled = false;
      return () => {
        if (cancelled) return;
        cancelled = true;
        const current = listeners.get(channel);
        if (!current) return;
        current.delete(entry);
        if (current.size > 0) return;
        listeners.delete(channel);
        if (socket?.connected) socket.emit(REALTIME_EVENTS.unsubscribe, { channel });
      };
    },

    disconnect() {
      listeners.clear();
      socket?.disconnect();
      socket = null;
    },
  };
}

let defaultClient: RealtimeClient | null = null;

function getDefaultClient(): RealtimeClient {
  defaultClient ??= createRealtimeClient({ url: env.wsUrl });
  return defaultClient;
}

export function subscribePositions(
  channel: PositionsChannel,
  onUpdate: PositionsListener,
): () => void {
  return getDefaultClient().subscribePositions(channel, onUpdate);
}
