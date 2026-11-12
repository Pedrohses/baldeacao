'use client';

import { useState } from 'react';

import { MapViewportSync, useMapStore } from '@/features/live-map';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { BaseMap, MapLayersOutlet } from '@/shared/ui/map';

/**
 * Mapa único das abas: montado uma vez no layout, guarda o viewport no store e desenha as
 * camadas que a tela atual registra com <MapLayers>.
 */
export function PersistentMap() {
  const isDesktop = useIsDesktop();
  // Só a primeira leitura importa: depois o próprio mapa é a fonte do viewport.
  const [viewport] = useState(() => useMapStore.getState().viewport);

  return (
    <BaseMap initialViewState={viewport} showNavigation={isDesktop}>
      <MapViewportSync />
      <MapLayersOutlet />
    </BaseMap>
  );
}
