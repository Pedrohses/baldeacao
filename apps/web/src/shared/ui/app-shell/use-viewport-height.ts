'use client';

import { useSyncExternalStore } from 'react';

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

/** Altura da janela em px (no servidor, um valor típico de celular). */
export function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerHeight,
    () => 800,
  );
}
