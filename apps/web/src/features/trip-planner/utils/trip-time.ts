import { CITY_TIME_ZONE, cityDate } from './format';

export type TripTimeMode = 'depart' | 'arrive';
export type TripDay = 'today' | 'tomorrow';

/** Hora da viagem escolhida no chip: agora, sair às ou chegar até (hoje ou amanhã). */
export type TripTime =
  { kind: 'now' } | { kind: TripTimeMode; day: TripDay; hour: number; minute: number };

export const TRIP_TIME_NOW: TripTime = { kind: 'now' };
export const MINUTE_STEP = 5;

// São Paulo não tem horário de verão desde 2019: o deslocamento é fixo.
const CITY_UTC_OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CITY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const pad = (value: number) => String(value).padStart(2, '0');

/** Minutos desde a meia-noite em São Paulo. */
function cityMinutes(date: Date): number {
  const [h, m] = clockFormatter.format(date).split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** Hora em São Paulo arredondada para cima no passo de 5 min (para o seletor abrir perto de agora). */
export function nextSlot(now: Date): { day: TripDay; hour: number; minute: number } {
  let total = Math.ceil(cityMinutes(now) / MINUTE_STEP) * MINUTE_STEP;
  let day: TripDay = 'today';
  if (total >= 24 * 60) {
    total -= 24 * 60;
    day = 'tomorrow';
  }
  return { day, hour: Math.floor(total / 60), minute: total % 60 };
}

/**
 * Hora que vale de fato: "hoje" com um horário que já passou vai para amanhã (como o MCP faz),
 * em vez de pedir ao planejador uma viagem no passado.
 */
export function effectiveTripTime(time: TripTime, now: Date): TripTime {
  if (time.kind === 'now' || time.day === 'tomorrow') return time;
  return time.hour * 60 + time.minute < cityMinutes(now) ? { ...time, day: 'tomorrow' } : time;
}

/** Campos do TripRequest para a hora escolhida (`departAt` ou `arriveBy`, em ISO com fuso). */
export function tripTimeFields(
  chosen: TripTime,
  now: Date,
): { departAt?: string; arriveBy?: string } {
  const time = effectiveTripTime(chosen, now);
  if (time.kind === 'now') return {};
  const base = time.day === 'tomorrow' ? new Date(now.getTime() + DAY_MS) : now;
  const iso = `${cityDate(base)}T${pad(time.hour)}:${pad(time.minute)}:00${CITY_UTC_OFFSET}`;
  return time.kind === 'depart' ? { departAt: iso } : { arriveBy: iso };
}

/** Texto do chip: "Sair agora", "Sair às 08:30", "Chegar até 09:00 amanhã". */
export function tripTimeLabel(chosen: TripTime, now: Date): string {
  const time = effectiveTripTime(chosen, now);
  if (time.kind === 'now') return 'Sair agora';
  const clock = `${pad(time.hour)}:${pad(time.minute)}`;
  const prefix = time.kind === 'depart' ? 'Sair às' : 'Chegar até';
  return `${prefix} ${clock}${time.day === 'tomorrow' ? ' amanhã' : ''}`;
}
