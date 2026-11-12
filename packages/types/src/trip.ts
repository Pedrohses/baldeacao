// Contratos v2 (Onda 2): lugares (geocodificação) e planejamento de viagem (OpenTripPlanner).
// Back: modules/geocoding e modules/routing. Front: features/place-search e features/trip-planner.
import { z } from 'zod';
import { CoordinatesSchema, EntityIdSchema, IsoDateTimeSchema } from './common.js';
import { RouteTypeSchema } from './transit.js';

export const PlaceKindSchema = z.enum(['address', 'poi', 'stop', 'coordinates']);
export type PlaceKind = z.infer<typeof PlaceKindSchema>;

/** Lugar devolvido pela busca (Nominatim) ou escolhido no mapa. */
export const PlaceSchema = z.object({
  id: z.string().min(1), // estável para o mesmo lugar, ex.: "osm:way:123" ou "coords:-23.5,-46.6"
  name: z.string().min(1), // nome curto para exibir, ex.: "Estádio do Morumbis"
  address: z.string().nullable(), // linha de endereço completa, quando houver
  kind: PlaceKindSchema,
  location: CoordinatesSchema,
});
export type Place = z.infer<typeof PlaceSchema>;

export const TripModeSchema = z.enum(['walk', ...RouteTypeSchema.options]);
export type TripMode = z.infer<typeof TripModeSchema>;

/** Pedido de viagem. Sem `departAt` nem `arriveBy`, parte agora. */
export const TripRequestSchema = z
  .object({
    from: CoordinatesSchema,
    to: CoordinatesSchema,
    departAt: IsoDateTimeSchema.optional(),
    arriveBy: IsoDateTimeSchema.optional(),
    maxItineraries: z.number().int().min(1).max(5).default(3),
  })
  .refine((r) => !(r.departAt && r.arriveBy), {
    message: 'Informe só a hora de saída ou só a de chegada.',
  });
export type TripRequest = z.infer<typeof TripRequestSchema>;

export const LegPlaceSchema = z.object({
  name: z.string().min(1),
  location: CoordinatesSchema,
  stopId: EntityIdSchema.nullable(), // stop_id do GTFS quando o ponto é uma parada
});
export type LegPlace = z.infer<typeof LegPlaceSchema>;

/** Trecho do itinerário: caminhada ou um veículo do transporte público. */
export const LegSchema = z.object({
  mode: TripModeSchema,
  from: LegPlaceSchema,
  to: LegPlaceSchema,
  startAt: IsoDateTimeSchema,
  endAt: IsoDateTimeSchema,
  durationS: z.number().int().nonnegative(),
  distanceM: z.number().nonnegative(),
  // Só em trechos de transporte (null na caminhada):
  routeId: EntityIdSchema.nullable(), // route_id do GTFS, ex.: "875A-10"
  routeShortName: z.string().nullable(),
  routeColor: z.string().nullable(), // hex sem "#", como no GTFS
  headsign: z.string().nullable(),
  intermediateStops: z.number().int().nonnegative(),
  isRealtime: z.boolean(),
  points: z.array(CoordinatesSchema).min(2), // geometria do trecho, já decodificada
});
export type Leg = z.infer<typeof LegSchema>;

export const ItinerarySchema = z.object({
  startAt: IsoDateTimeSchema,
  endAt: IsoDateTimeSchema,
  durationS: z.number().int().nonnegative(),
  walkDistanceM: z.number().nonnegative(),
  transfers: z.number().int().nonnegative(), // baldeações
  legs: z.array(LegSchema).min(1),
});
export type Itinerary = z.infer<typeof ItinerarySchema>;
