import type { Leg, TripMode } from '@baldeacao/types';

// Horários exibidos no fuso da cidade atendida (São Paulo), não no do aparelho.
export const CITY_TIME_ZONE = 'America/Sao_Paulo';

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: CITY_TIME_ZONE,
});

// Cinza "muted" do tema e petróleo da marca (o paint do mapa não lê variáveis CSS).
export const WALK_COLOR = '#6F574A';
export const FALLBACK_TRANSIT_COLOR = '#C7361F';

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

export type DepartureTone = 'now' | 'soon' | 'later';

/** "Sai agora" (menos de 2 min), "Sai em 4 min" (até 1 h) ou "Sai às 08:30". */
export function formatDeparture(startAt: string, now: Date): { text: string; tone: DepartureTone } {
  const minutes = Math.floor((Date.parse(startAt) - now.getTime()) / 60_000);
  if (minutes < 2) return { text: 'Sai agora', tone: 'now' };
  if (minutes <= 60) return { text: `Sai em ${minutes} min`, tone: 'soon' };
  return { text: `Sai às ${formatTime(startAt)}`, tone: 'later' };
}

/** Minutos entre o fim de um trecho e o começo de outro (espera da baldeação). */
export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
}

/** Cor do trecho em "#RRGGBB": cinza na caminhada, cor da linha (GTFS) ou a cor da marca. */
export function legColor(leg: Pick<Leg, 'mode' | 'routeColor'>): string {
  if (leg.mode === 'walk') return WALK_COLOR;
  return leg.routeColor ? `#${leg.routeColor.toUpperCase()}` : FALLBACK_TRANSIT_COLOR;
}

/** Preto ou branco, o que tiver mais contraste com o fundo "#RRGGBB" (luminância relativa WCAG). */
export function readableTextColor(background: string): '#000000' | '#FFFFFF' {
  const hex = background.replace('#', '');
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  // Contraste com branco (1.05 / (L + 0.05)) contra preto ((L + 0.05) / 0.05).
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#FFFFFF' : '#000000';
}
