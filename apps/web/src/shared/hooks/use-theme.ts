'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';

import {
  applyThemePreference,
  currentTheme,
  readThemePreference,
  saveThemePreference,
  SYSTEM_DARK_QUERY,
  type Theme,
  type ThemePreference,
} from '@/shared/lib/theme';

function subscribeTheme(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Tema resolvido (`data-theme` do <html>); no servidor vale o padrão escuro. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, currentTheme, () => 'dark');
}

const preferenceListeners = new Set<() => void>();

function subscribePreference(onChange: () => void): () => void {
  preferenceListeners.add(onChange);
  return () => preferenceListeners.delete(onChange);
}

/** Preferência guardada e a função que a troca (salva, aplica e avisa quem escuta). */
export function useThemePreference(): [ThemePreference, (next: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    subscribePreference,
    readThemePreference,
    () => 'dark' as const,
  );

  // Em "sistema", acompanha a troca de claro/escuro do aparelho.
  useEffect(() => {
    if (preference !== 'system' || typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = () => applyThemePreference('system');
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    saveThemePreference(next);
    preferenceListeners.forEach((listener) => listener());
  }, []);

  return [preference, setPreference];
}
