import { z } from 'zod';

import { readStorage, storageKey, writeStorage } from './storage';

/**
 * Tema do app (MASTER.md): escuro é o padrão, claro é alternativa e "sistema" segue o aparelho.
 * O tema resolvido vai para `data-theme` no <html>; o CSS e o mapa leem de lá.
 */
export const THEME_PREFERENCES = ['dark', 'light', 'system'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'theme';
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';
const ThemePreferenceSchema = z.enum(THEME_PREFERENCES);

export function readThemePreference(): ThemePreference {
  return readStorage(THEME_KEY, ThemePreferenceSchema) ?? DEFAULT_THEME_PREFERENCE;
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(SYSTEM_DARK_QUERY).matches
    : true;
}

/** Põe o tema resolvido no <html>. Sem documento (servidor, teste sem DOM), não faz nada. */
export function applyThemePreference(preference: ThemePreference): Theme {
  const theme = resolveTheme(preference, systemPrefersDark());
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
  return theme;
}

export function saveThemePreference(preference: ThemePreference): void {
  writeStorage(THEME_KEY, preference);
  applyThemePreference(preference);
}

/** Tema atual lido do <html>; sem atributo vale o padrão escuro. */
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/**
 * Script inline do <head>: aplica o tema antes da primeira pintura, sem piscar. Repete a lógica
 * acima em JS puro porque roda antes do bundle; dado inválido cai no padrão escuro.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p='${DEFAULT_THEME_PREFERENCE}';var r=localStorage.getItem('${storageKey(THEME_KEY)}');if(r){var v=JSON.parse(r);if(v==='dark'||v==='light'||v==='system')p=v;}var t=p==='system'?(matchMedia('${SYSTEM_DARK_QUERY}').matches?'dark':'light'):p;document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export { SYSTEM_DARK_QUERY };
