'use client';

import dynamic from 'next/dynamic';

// MapLibre depende de window/WebGL: carrega só no cliente.
export const BaseMap = dynamic(() => import('./base-map-client'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-surface-2" aria-label="Carregando mapa" />
  ),
});
