import { z } from 'zod';

// Data e hora em ISO 8601 com fuso (ex.: "2026-11-12T08:30:00-03:00" ou "...Z").
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

// Coordenada sempre como objeto { lat, lon } em WGS 84 (graus decimais).
// Para GeoJSON e MapLibre, que usam [lon, lat], converta com toLonLat.
export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Coordinates = z.infer<typeof CoordinatesSchema>;

export type LonLat = [lon: number, lat: number];

export function toLonLat({ lat, lon }: Coordinates): LonLat {
  return [lon, lat];
}

// Fonte de dados (adaptador), ex.: "sptrans".
export const SourceIdSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'source id em minúsculas, dígitos e hífen');
export type SourceId = z.infer<typeof SourceIdSchema>;

// Ids vindos da fonte (GTFS ou Olho Vivo) são sempre texto, nunca número.
export const EntityIdSchema = z.string().min(1);
export type EntityId = z.infer<typeof EntityIdSchema>;

// Sentido da viagem como no GTFS (direction_id): 0 ida, 1 volta.
export const DirectionIdSchema = z.union([z.literal(0), z.literal(1)]);
export type DirectionId = z.infer<typeof DirectionIdSchema>;
