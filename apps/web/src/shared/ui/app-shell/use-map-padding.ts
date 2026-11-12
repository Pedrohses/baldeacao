'use client';

import { useMemo } from 'react';

import { useIsDesktop } from '@/shared/hooks/use-media-query';

import { type MapPadding, type PanelSnap, mapPaddingFor } from './panel-snap';
import { useViewportHeight } from './use-viewport-height';

/** Folga de enquadramento do mapa conforme o painel da tela (lateral ou bottom sheet). */
export function useMapPadding(snap: PanelSnap): MapPadding {
  const isDesktop = useIsDesktop();
  const height = useViewportHeight();
  // Objeto estável enquanto os números não mudam: é dependência do enquadramento no mapa.
  return useMemo(() => mapPaddingFor(isDesktop, snap, height), [isDesktop, snap, height]);
}
