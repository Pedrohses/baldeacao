import { z } from 'zod';
import { Arrival } from '../../domain/entities/arrival.entity';
import type { DirectionId } from '../../domain/value-objects/route-type';

const SAO_PAULO_TZ = 'America/Sao_Paulo';
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HALF_DAY_MIN = 12 * 60;
const DAY_MIN = 24 * 60;

/** Resposta de GET /Previsao/Parada (API v2.1); só o que usamos. */
export const OlhoVivoStopForecastSchema = z.object({
  hr: z.string().regex(HH_MM),
  p: z
    .object({
      cp: z.number(),
      l: z.array(
        z.object({
          c: z.string().min(1), // letreiro completo, igual ao route_id do GTFS da SPTrans
          sl: z.union([z.literal(1), z.literal(2)]),
          lt0: z.string(),
          lt1: z.string(),
          vs: z.array(
            z.object({
              p: z.union([z.string(), z.number()]),
              t: z.string().regex(HH_MM),
              a: z.boolean().nullable().optional(),
              py: z.number(),
              px: z.number(),
            }),
          ),
        }),
      ),
    })
    .nullable(),
});
export type OlhoVivoStopForecast = z.infer<typeof OlhoVivoStopForecastSchema>;

/**
 * Converte a previsão da Olho Vivo em Arrival.
 * - sl 1 (terminal principal para secundário) é direction_id 0; sl 2 é 1.
 * - O destino mostrado é lt1 no sentido 1 e lt0 no sentido 2 (coerente com trip_headsign).
 * - `t` e `hr` vêm em HH:mm no horário de São Paulo; a data sai de `now` e vira o dia
 *   quando a previsão passa da meia-noite.
 */
export function toArrivals(forecast: OlhoVivoStopForecast, stopId: string, now: Date): Arrival[] {
  if (!forecast.p) return [];
  const reference = localReference(forecast.hr, now);

  return forecast.p.l.flatMap((line) => {
    const directionId: DirectionId = line.sl === 1 ? 0 : 1;
    const headsign = (line.sl === 1 ? line.lt1 : line.lt0).trim() || null;
    return line.vs.map(
      (vehicle) =>
        new Arrival({
          stopId,
          routeId: line.c,
          routeShortName: line.c,
          directionId,
          headsign,
          vehicleId: String(vehicle.p),
          expectedAt: reference.at(vehicle.t),
          isRealtime: true,
          accessible: vehicle.a ?? null,
          vehicleLocation: { lat: vehicle.py, lon: vehicle.px },
        }),
    );
  });
}

interface LocalReference {
  at(hhmm: string): string;
}

function localReference(hr: string, now: Date): LocalReference {
  const local = saoPauloParts(now);
  const hrMin = minutesOf(hr);
  // `hr` pode estar um pouco atrás de `now` logo depois da meia-noite: aí o hr é de ontem.
  let baseDayOffset = 0;
  if (hrMin - local.minutes > HALF_DAY_MIN) baseDayOffset = -1;
  else if (local.minutes - hrMin > HALF_DAY_MIN) baseDayOffset = 1;

  return {
    at(hhmm: string): string {
      const tMin = minutesOf(hhmm);
      // Previsão "antes" do horário de referência por mais de meio dia é do dia seguinte.
      const dayOffset = baseDayOffset + (hrMin - tMin > HALF_DAY_MIN ? 1 : 0);
      return `${addDays(local.date, dayOffset)}T${hhmm}:00${local.offset}`;
    },
  };
}

function saoPauloParts(now: Date): { date: string; minutes: number; offset: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  // "GMT-03:00" vira "-03:00"; "GMT" puro (UTC) vira "+00:00".
  const offset = get('timeZoneName').replace('GMT', '') || '+00:00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: (Number(get('hour')) * 60 + Number(get('minute'))) % DAY_MIN,
    offset,
  };
}

function minutesOf(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

function addDays(isoDate: string, days: number): string {
  if (days === 0) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}
