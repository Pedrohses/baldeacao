import { PlaceSchema, TripRequestSchema, type TripRequest } from '@baldeacao/types';
import { z } from 'zod';

import { type TripTime, tripTimeFields } from '../utils/trip-time';

export const MAX_ITINERARIES = 3;

export const tripFormSchema = z.object({
  origin: PlaceSchema.nullable(),
  destination: PlaceSchema.nullable(),
});

export type TripFormValues = z.infer<typeof tripFormSchema> & { time: TripTime };

/** Pedido pronto, ainda incompleto (sem erro a mostrar) ou inválido (com mensagem). */
export type TripFormResult =
  | { status: 'ready'; request: TripRequest }
  | { status: 'incomplete' }
  | { status: 'invalid'; message: string };

const SAME_PLACE_METERS = 30;

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

/**
 * Monta o TripRequest assim que origem e destino estão definidos (a busca é automática).
 * Sem hora escolhida, parte agora.
 */
export function buildTripRequest(values: TripFormValues, now: Date = new Date()): TripFormResult {
  const parsed = tripFormSchema.safeParse(values);
  if (!parsed.success) return { status: 'incomplete' };
  const { origin, destination } = parsed.data;
  if (!origin || !destination) return { status: 'incomplete' };
  if (
    origin.id === destination.id ||
    distanceMeters(origin.location, destination.location) < SAME_PLACE_METERS
  ) {
    return { status: 'invalid', message: 'Origem e destino precisam ser diferentes.' };
  }
  const request = TripRequestSchema.safeParse({
    from: origin.location,
    to: destination.location,
    ...tripTimeFields(values.time, now),
    maxItineraries: MAX_ITINERARIES,
  });
  if (!request.success) return { status: 'invalid', message: 'Hora da viagem inválida.' };
  return { status: 'ready', request: request.data };
}
