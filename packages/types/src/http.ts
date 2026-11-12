// Contrato HTTP v1 da API REST (Onda 1). Back implementa estas rotas; front consome via api-client.
// Rotas GET devolvem JSON validado pelos schemas abaixo; planTrip é POST (corpo TripRequest).
import { z } from 'zod';
import { ArrivalSchema, LineShapeSchema, RouteSchema, StopSchema } from './transit.js';
import { ItinerarySchema, PlaceSchema } from './trip.js';

export const API_PATHS = {
  /** Busca de linhas por texto (código ou nome). Query: `q` (mínimo 2 caracteres). */
  searchLines: '/lines',
  /** Linha por id (route_id do GTFS) com o traçado de cada sentido. */
  lineDetails: (routeId: string) => `/lines/${encodeURIComponent(routeId)}`,
  /** Paradas num raio. Query: `lat`, `lon`, `radius` em metros (padrão 500, máximo 2000). */
  nearbyStops: '/stops/nearby',
  /** Previsão de chegada numa parada (Olho Vivo, cache curto). */
  stopArrivals: (stopId: string) => `/stops/${encodeURIComponent(stopId)}/arrivals`,
  /** Snapshot de posições. Query opcional: `routeId`; sem ela, todas as linhas. */
  vehiclePositions: '/vehicles/positions',
  /**
   * v2: busca de lugar. Query: `q` (mínimo 2 caracteres) e `mode`:
   * `quick` (padrão, autocompletar) busca só paradas e estações locais, sem Nominatim;
   * `full` (busca confirmada) junta o local com endereços do Nominatim (com cache).
   */
  searchPlaces: '/places/search',
  /** v2: lugar mais próximo de um ponto (Nominatim reverse, com cache). Query: `lat`, `lon`. */
  reversePlace: '/places/reverse',
  /** v2: planejar viagem (OpenTripPlanner). POST com corpo TripRequest. */
  planTrip: '/trips/plan',
} as const;

export const NEARBY_STOPS_DEFAULT_RADIUS_M = 500;
export const NEARBY_STOPS_MAX_RADIUS_M = 2000;

export const SearchLinesQuerySchema = z.object({ q: z.string().trim().min(2) });
export type SearchLinesQuery = z.infer<typeof SearchLinesQuerySchema>;

export const SearchLinesResponseSchema = z.object({ lines: z.array(RouteSchema) });
export type SearchLinesResponse = z.infer<typeof SearchLinesResponseSchema>;

export const LineDetailsResponseSchema = z.object({
  line: RouteSchema,
  shapes: z.array(LineShapeSchema), // um por sentido quando existir
});
export type LineDetailsResponse = z.infer<typeof LineDetailsResponseSchema>;

export const NearbyStopsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  radius: z.coerce
    .number()
    .int()
    .positive()
    .max(NEARBY_STOPS_MAX_RADIUS_M)
    .default(NEARBY_STOPS_DEFAULT_RADIUS_M),
});
export type NearbyStopsQuery = z.infer<typeof NearbyStopsQuerySchema>;

export const NearbyStopSchema = StopSchema.extend({ distanceM: z.number().nonnegative() });
export type NearbyStop = z.infer<typeof NearbyStopSchema>;

export const NearbyStopsResponseSchema = z.object({ stops: z.array(NearbyStopSchema) });
export type NearbyStopsResponse = z.infer<typeof NearbyStopsResponseSchema>;

export const StopArrivalsResponseSchema = z.object({
  stopId: z.string().min(1),
  arrivals: z.array(ArrivalSchema), // ordenadas por expectedAt
});
export type StopArrivalsResponse = z.infer<typeof StopArrivalsResponseSchema>;

export const VehiclePositionsQuerySchema = z.object({ routeId: z.string().min(1).optional() });
export type VehiclePositionsQuery = z.infer<typeof VehiclePositionsQuerySchema>;
// A resposta de vehiclePositions é um VehicleSnapshot (realtime.ts).

/** Corpo de erro padrão da API (mensagem em português). */
export const ApiErrorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

// ---- v2 (Onda 2) ----

export const SearchPlacesModeSchema = z.enum(['quick', 'full']);
export type SearchPlacesMode = z.infer<typeof SearchPlacesModeSchema>;

export const SearchPlacesQuerySchema = z.object({
  q: z.string().trim().min(2),
  mode: SearchPlacesModeSchema.default('quick'),
});
export type SearchPlacesQuery = z.infer<typeof SearchPlacesQuerySchema>;

export const SearchPlacesResponseSchema = z.object({ places: z.array(PlaceSchema) });
export type SearchPlacesResponse = z.infer<typeof SearchPlacesResponseSchema>;

// O corpo de planTrip é TripRequestSchema (trip.ts).
export const ReversePlaceQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});
export type ReversePlaceQuery = z.infer<typeof ReversePlaceQuerySchema>;

export const ReversePlaceResponseSchema = z.object({ place: PlaceSchema.nullable() });
export type ReversePlaceResponse = z.infer<typeof ReversePlaceResponseSchema>;

/** Motivo de uma resposta vazia ou limitada do planejador. */
export const PlanTripNoticeSchema = z.enum([
  'origin_outside_service_area', // nenhuma parada a até 1 km da origem
  'destination_outside_service_area', // nenhuma parada a até 1 km do destino
]);
export type PlanTripNotice = z.infer<typeof PlanTripNoticeSchema>;

export const PlanTripResponseSchema = z.object({
  itineraries: z.array(ItinerarySchema),
  notices: z.array(PlanTripNoticeSchema).optional(),
});
export type PlanTripResponse = z.infer<typeof PlanTripResponseSchema>;
