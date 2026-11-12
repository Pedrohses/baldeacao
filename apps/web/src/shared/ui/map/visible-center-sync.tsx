'use client';

import type { Coordinates } from '@baldeacao/types';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { type PaddingBox, visibleCenterPoint } from './fit-padding';

export interface VisibleCenterSyncProps {
  /** Parte do canvas coberta pelo painel (a mesma folga do enquadramento). */
  padding: PaddingBox;
  onChange: (center: Coordinates) => void;
}

/**
 * Sem UI: informa o centro da área visível do mapa (descontando painel ou bottom sheet) ao fim
 * de cada movimento e quando o painel muda. Fica dentro do BaseMap.
 */
export function VisibleCenterSync({ padding, onChange }: VisibleCenterSyncProps) {
  const { current: map } = useMap();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!map) return;
    const report = () => {
      const container = map.getContainer();
      const point = visibleCenterPoint(padding, container.clientWidth, container.clientHeight);
      const { lng, lat } = map.unproject(point);
      onChangeRef.current({ lat, lon: lng });
    };
    report();
    map.on('moveend', report);
    return () => {
      map.off('moveend', report);
    };
  }, [map, padding]);

  return null;
}
