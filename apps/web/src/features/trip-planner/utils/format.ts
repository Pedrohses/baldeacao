import type { Leg, TripMode } from '@baldeacao/types';

// Horários exibidos no fuso da cidade atendida (São Paulo), não no do aparelho.
export const CITY_TIME_ZONE = 'America/Sao_Paulo';

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: CITY_TIME_ZONE,
});

// Cinza "muted" do tema e neutro de linha sem cor (o paint do mapa não lê variáveis CSS). O
// neutro serve nos dois temas; a cor da marca fica para ação e seleção, nunca para linha.
export const WALK_COLOR = '#6F574A';
export const FALLBACK_TRANSIT_COLOR = '#8A7262';

export const MODE_LABELS: Record<TripMode, string> = {
  walk: 'A pé',
  bus: 'Ônibus',
  trolleybus: 'Trólebus',
  subway: 'Metrô',
  rail: 'Trem',
  tram: 'Bonde',
  ferry: 'Balsa',
};

export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

export function formatTransfers(transfers: number): string {
  if (transfers === 0) return 'Sem baldeação';
  return transfers === 1 ? '1 baldeação' : `${transfers} baldeações`;
}

export function formatStops(count: number): string {
  return count === 1 ? '1 parada' : `${count} paradas`;
}

/** Nome curto da linha: "METRÔ L4" vira "L4", "CPTM L9" vira "L9". */
export function shortRouteName(name: string | null): string | null {
  if (!name) return null;
  return name.replace(/^(METR[ÔO]|CPTM)\s+/i, '').trim() || name;
}

/** Nomes genéricos do OTP ("Destino", "Origem") viram texto corrido: "o destino", "a origem". */
export function placeLabel(name: string): string {
  const normalized = name.trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'destino') return 'o destino';
  if (normalized === 'origem') return 'a origem';
  return name;
}

export type DepartureTone = 'past' | 'now' | 'soon' | 'later';

const cityDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CITY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Data "AAAA-MM-DD" em São Paulo. */
export function cityDate(date: Date): string {
  return cityDateFormatter.format(date);
}

/**
 * "Saiu às 07:50" (já passou), "Sai agora" (menos de 2 min), "Sai em 4 min" (até 1 h),
 * "Sai às 08:30" ou "Sai amanhã às 07:00" (outro dia).
 */
export function formatDeparture(startAt: string, now: Date): { text: string; tone: DepartureTone } {
  const minutes = Math.floor((Date.parse(startAt) - now.getTime()) / 60_000);
  if (minutes < 0) return { text: `Saiu às ${formatTime(startAt)}`, tone: 'past' };
  if (minutes < 2) return { text: 'Sai agora', tone: 'now' };
  if (minutes <= 60) return { text: `Sai em ${minutes} min`, tone: 'soon' };
  const otherDay = cityDate(new Date(startAt)) !== cityDate(now);
  return { text: `Sai ${otherDay ? 'amanhã ' : ''}às ${formatTime(startAt)}`, tone: 'later' };
}

/** Minutos entre o fim de um trecho e o começo de outro (espera da baldeação). */
export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
}

/** Cor do trecho em "#RRGGBB": cinza na caminhada, cor da linha (GTFS) ou o neutro de linha. */
export function legColor(leg: Pick<Leg, 'mode' | 'routeColor'>): string {
  if (leg.mode === 'walk') return WALK_COLOR;
  return leg.routeColor ? `#${leg.routeColor.toUpperCase()}` : FALLBACK_TRANSIT_COLOR;
}

/** Velocidade a pé usada para estimar a caminhada (m/s). */
export const WALK_SPEED_MS = 1.2;

/** Caminhadas menores que isto (m) não aparecem na linha do tempo. */
export const MIN_WALK_LEG_M = 20;

export function isTinyWalk(leg: Pick<Leg, 'mode' | 'distanceM'>): boolean {
  return leg.mode === 'walk' && leg.distanceM < MIN_WALK_LEG_M;
}

/**
 * Segundos de espera embutidos num trecho a pé: o tempo do trecho menos a caminhada estimada.
 * Só conta se sobrar pelo menos 2 min (e o dobro da caminhada), senão é folga normal.
 */
export function walkWaitSeconds(leg: Pick<Leg, 'distanceM' | 'durationS'>): number {
  const walking = Math.round(leg.distanceM / WALK_SPEED_MS / 60) * 60;
  const wait = leg.durationS - leg.distanceM / WALK_SPEED_MS;
  return wait >= 120 && leg.durationS >= 2 * walking ? Math.round(wait / 60) * 60 : 0;
}
