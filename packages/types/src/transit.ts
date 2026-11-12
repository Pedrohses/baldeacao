import { z } from 'zod';
import {
  CoordinatesSchema,
  DirectionIdSchema,
  EntityIdSchema,
  IsoDateTimeSchema,
  SourceIdSchema,
} from './common.js';

// Rede planejada (GTFS, Postgres) e previsão de chegada (Olho Vivo).

export const RouteTypeSchema = z.enum(['bus', 'trolleybus', 'subway', 'rail', 'tram', 'ferry']);
export type RouteType = z.infer<typeof RouteTypeSchema>;

const HexColorSchema = z.string().regex(/^[0-9A-Fa-f]{6}$/, 'cor hex sem #');

export const RouteSchema = z.object({
  id: EntityIdSchema, // route_id do GTFS, ex.: "875A-10"
  sourceId: SourceIdSchema,
  shortName: z.string().min(1), // letreiro, ex.: "875A-10"
  longName: z.string(),
  type: RouteTypeSchema,
  color: HexColorSchema.nullable(),
  textColor: HexColorSchema.nullable(),
});
export type Route = z.infer<typeof RouteSchema>;

export const StopSchema = z.object({
  id: EntityIdSchema, // stop_id do GTFS
  sourceId: SourceIdSchema,
  code: z.string().nullable(), // stop_code, quando existe
  name: z.string().min(1),
  description: z.string().nullable(),
  location: CoordinatesSchema,
});
export type Stop = z.infer<typeof StopSchema>;

// Traçado de uma linha num sentido (shapes do GTFS), em ordem de percurso.
export const LineShapeSchema = z.object({
  routeId: EntityIdSchema,
  sourceId: SourceIdSchema,
  directionId: DirectionIdSchema,
  shapeId: EntityIdSchema,
  points: z.array(CoordinatesSchema).min(2),
});
export type LineShape = z.infer<typeof LineShapeSchema>;

// Uma previsão de chegada de um veículo numa parada.
export const ArrivalSchema = z.object({
  stopId: EntityIdSchema,
  routeId: EntityIdSchema,
  routeShortName: z.string().min(1),
  directionId: DirectionIdSchema,
  headsign: z.string().nullable(), // destino mostrado no letreiro
  vehicleId: EntityIdSchema.nullable(), // null quando a previsão vem só da tabela
  expectedAt: IsoDateTimeSchema,
  isRealtime: z.boolean(), // true se veio da Olho Vivo, false se da tabela GTFS
  accessible: z.boolean().nullable(),
  vehicleLocation: CoordinatesSchema.nullable(),
});
export type Arrival = z.infer<typeof ArrivalSchema>;
