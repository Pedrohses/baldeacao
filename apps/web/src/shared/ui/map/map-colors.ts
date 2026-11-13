'use client';

import { env } from '@/shared/config/env';
import { useTheme } from '@/shared/hooks/use-theme';

export type MapTheme = 'light' | 'dark';

// O paint do MapLibre não lê variáveis CSS: estes são os tokens de globals.css em hex
// (MASTER.md), casados com o estilo do mapa de cada tema (positron no claro, dark no escuro).
export const MAP_COLORS = {
  /** Âmbar: só seleção e ação (parada escolhida, alfinete); nunca dado. */
  brand: '#FFB300',
  text: '#0E1116',
  muted: '#5B6472',
  surface: '#FFFFFF',
  live: '#0F7A3D',
  /** Ônibus sem linha em destaque. */
  vehicleIdle: '#5B6472',
  /** Linha sem cor no GTFS (mesmo neutro do selo). */
  lineFallback: '#5B6472',
} as const;

export const MAP_COLORS_DARK = {
  brand: '#FFB300',
  text: '#F4F5F7',
  muted: '#A3ABB8',
  surface: '#161A21',
  live: '#3DDC84',
  vehicleIdle: '#A3ABB8',
  lineFallback: '#4A5262',
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

/** Tema do mapa segue o do app (`data-theme` do <html>; escuro por padrão). */
export function useMapTheme(): MapTheme {
  return useTheme();
}

/** Cores para o paint do mapa no tema (tokens `--map-*`). */
export function mapColorsFor(theme: MapTheme): MapColors {
  return theme === 'dark' ? MAP_COLORS_DARK : MAP_COLORS;
}

/** Cores para o paint das camadas no tema atual. */
export function useMapColors(): MapColors {
  return useMapTheme() === 'dark' ? MAP_COLORS_DARK : MAP_COLORS;
}
