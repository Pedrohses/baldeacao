'use client';

import { env } from '@/shared/config/env';
import { useMediaQuery } from '@/shared/hooks/use-media-query';

export const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

export type MapTheme = 'light' | 'dark';

// O paint do MapLibre não lê variáveis CSS: estes são os tokens de globals.css em hex,
// casados com o estilo do mapa de cada tema (positron no claro, dark no escuro).
export const MAP_COLORS = {
  /** Só seleção e ação (parada escolhida, alfinete); nunca dado. */
  brand: '#C7361F',
  text: '#2B1B14',
  muted: '#6F574A',
  surface: '#FFFFFF',
  live: '#1B7F45',
  /** Ônibus sem linha em destaque. */
  vehicleIdle: '#5A4A40',
  /** Linha sem cor no GTFS (mesmo neutro do selo). */
  lineFallback: '#5A4A40',
} as const;

export const MAP_COLORS_DARK = {
  brand: '#FF8A65',
  text: '#F8ECE3',
  muted: '#C9B4A6',
  surface: '#251C17',
  live: '#5BD68A',
  vehicleIdle: '#C9B4A6',
  lineFallback: '#8A7262',
} as const;

export type MapColors = { readonly [K in keyof typeof MAP_COLORS]: string };

/**
 * Estilo escuro derivado do claro: no OpenFreeMap, ".../styles/positron" vira ".../styles/dark".
 * Estilo que não termina em "positron" (ex.: um próprio) vale para os dois temas.
 */
export function darkStyleUrl(lightUrl: string): string {
  return lightUrl.replace(/\/positron(\/?(?:[?#].*)?)$/, '/dark$1');
}

export const MAP_STYLE_URLS: Record<MapTheme, string> = {
  light: env.mapStyleUrl,
  dark: darkStyleUrl(env.mapStyleUrl),
};

/** Tema do mapa segue o do sistema (`prefers-color-scheme`). */
export function useMapTheme(): MapTheme {
  return useMediaQuery(DARK_SCHEME_QUERY) ? 'dark' : 'light';
}

/** Cores para o paint do mapa no tema (tokens `--map-*`). */
export function mapColorsFor(theme: MapTheme): MapColors {
  return theme === 'dark' ? MAP_COLORS_DARK : MAP_COLORS;
}

/** Cores para o paint das camadas no tema atual. */
export function useMapColors(): MapColors {
  return useMapTheme() === 'dark' ? MAP_COLORS_DARK : MAP_COLORS;
}
