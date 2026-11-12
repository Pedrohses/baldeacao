'use client';

import { useSyncExternalStore } from 'react';

/** Breakpoint `md` do Tailwind: a partir dele o app usa trilho e painel lateral. */
export const DESKTOP_QUERY = '(min-width: 768px)';

function canMatch(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

/** Estado de uma media query; no servidor (e sem matchMedia) vale `false`, o layout de celular. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!canMatch()) return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => (canMatch() ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
