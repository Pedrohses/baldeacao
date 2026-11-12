'use client';

import type { Coordinates } from '@baldeacao/types';
import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

export interface MapFlyToProps {
  /** Ponto a centralizar; trocar o objeto refaz o voo. null não faz nada. */
  target: Coordinates | null;
  minZoom?: number;
}

/** Sem UI: centraliza o mapa no alvo quando ele muda. Fica dentro do BaseMap. */
export function MapFlyTo({ target, minZoom = 16 }: MapFlyToProps) {
  const { current: map } = useMap();
  useEffect(() => {
    if (!map || !target) return;
    map.flyTo({
      center: [target.lon, target.lat],
      zoom: Math.max(map.getZoom(), minZoom),
      duration: 600,
    });
  }, [map, target, minZoom]);
  return null;
}
