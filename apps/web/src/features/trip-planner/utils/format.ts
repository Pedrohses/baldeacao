import type { Leg, TripMode } from '@baldeacao/types';

// Horários exibidos no fuso da cidade atendida (São Paulo), não no do aparelho.
const CITY_TIME_ZONE = 'America/Sao_Paulo';

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: CITY_TIME_ZONE,
});

export const WALK_COLOR = '#525252';
export const FALLBACK_TRANSIT_COLOR = '#1D4ED8';

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

/** Cor do trecho em "#RRGGBB": cinza na caminhada, cor da linha (GTFS) ou azul padrão. */
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
