import { z } from 'zod';
import {
  CoordinatesSchema,
  DirectionIdSchema,
  EntityIdSchema,
  IsoDateTimeSchema,
  SourceIdSchema,
} from './common.js';

// Fixtures coerentes com estes contratos: apps/api/test/fixtures/olho-vivo/ (e gtfs/sptrans-mini/).
// Tempo real: posições lidas pelo worker (Redis) e eventos do WebSocket (Socket.IO).

// Intervalo do ciclo do worker e limite a partir do qual a UI mostra "dados atrasados".
export const REALTIME_CYCLE_MS = 30_000;
export const REALTIME_STALE_AFTER_MS = 3 * REALTIME_CYCLE_MS;

export const VehiclePositionSchema = z.object({
  vehicleId: EntityIdSchema, // prefixo do veículo na Olho Vivo
  sourceId: SourceIdSchema,
  routeId: EntityIdSchema,
  routeShortName: z.string().min(1),
  directionId: DirectionIdSchema,
  location: CoordinatesSchema,
  accessible: z.boolean().nullable(),
  recordedAt: IsoDateTimeSchema, // horário da leitura informado pela fonte
});
export type VehiclePosition = z.infer<typeof VehiclePositionSchema>;

// Foto das posições de uma fonte, de todas as linhas ou de uma só.
export const VehicleSnapshotSchema = z.object({
  sourceId: SourceIdSchema,
  routeId: EntityIdSchema.nullable(), // null quando são todas as linhas
  // Último dado bom da fonte (realtime:{source}:updated_at); base do isStale no front.
  updatedAt: IsoDateTimeSchema,
  vehicles: z.array(VehiclePositionSchema),
});
export type VehicleSnapshot = z.infer<typeof VehicleSnapshotSchema>;

export function isSnapshotStale(
  snapshot: Pick<VehicleSnapshot, 'updatedAt'>,
  now: Date = new Date(),
  staleAfterMs: number = REALTIME_STALE_AFTER_MS,
): boolean {
  return now.getTime() - Date.parse(snapshot.updatedAt) > staleAfterMs;
}

// Canais (salas do Socket.IO).
export const POSITIONS_ALL_CHANNEL = 'positions:all';
export const POSITIONS_LINE_CHANNEL_PREFIX = 'positions:line:';

export type PositionsAllChannel = typeof POSITIONS_ALL_CHANNEL;
export type PositionsLineChannel = `${typeof POSITIONS_LINE_CHANNEL_PREFIX}${string}`;
export type PositionsChannel = PositionsAllChannel | PositionsLineChannel;

// O route_id do GTFS pode ter espaço ("METRÔ L4", "CPTM L09"); só ":" é proibido, pois separa o prefixo do canal.
const LineCodeSchema = z
  .string()
  .regex(/^[^:]+$/, 'código de linha sem ":"')
  .refine(
    (code) => code.trim() === code && code.length > 0,
    'código de linha vazio ou com espaço nas pontas',
  );

export const PositionsChannelSchema = z.union([
  z.literal(POSITIONS_ALL_CHANNEL),
  z.templateLiteral([POSITIONS_LINE_CHANNEL_PREFIX, LineCodeSchema]),
]);

export function positionsLineChannel(lineCode: string): PositionsLineChannel {
  return `${POSITIONS_LINE_CHANNEL_PREFIX}${LineCodeSchema.parse(lineCode)}`;
}

export const REALTIME_EVENTS = {
  subscribe: 'positions:subscribe', // cliente entra num canal
  unsubscribe: 'positions:unsubscribe', // cliente sai de um canal
  update: 'positions:update', // servidor envia o ciclo do worker
} as const;
export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export const PositionsSubscriptionSchema = z.object({
  channel: PositionsChannelSchema,
});
export type PositionsSubscription = z.infer<typeof PositionsSubscriptionSchema>;

// Payload de cada ciclo (~30 s): a foto completa do canal, não um diff.
export const PositionsUpdateSchema = VehicleSnapshotSchema.extend({
  channel: PositionsChannelSchema,
});
export type PositionsUpdate = z.infer<typeof PositionsUpdateSchema>;

// Mapas de eventos para tipar o Socket.IO: Server<ClientToServerEvents, ServerToClientEvents>.
export interface ServerToClientEvents {
  [REALTIME_EVENTS.update]: (payload: PositionsUpdate) => void;
}

export interface ClientToServerEvents {
  [REALTIME_EVENTS.subscribe]: (payload: PositionsSubscription) => void;
  [REALTIME_EVENTS.unsubscribe]: (payload: PositionsSubscription) => void;
}
