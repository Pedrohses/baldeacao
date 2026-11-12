'use client';

import type { Coordinates } from '@baldeacao/types';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';

export const LONG_PRESS_MS = 550;
// Dedo que andou mais que isso está arrastando o mapa, não segurando.
const MOVE_TOLERANCE_PX = 10;

interface PointerLikeEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  originalEvent?: object;
  preventDefault?: () => void;
}

export interface MapLongPressProps {
  onLongPress: (location: Coordinates) => void;
}

/**
 * Sem UI: toque longo (celular) ou clique direito (desktop) no mapa entrega a coordenada.
 * Fica dentro do BaseMap.
 */
export function MapLongPress({ onLongPress }: MapLongPressProps) {
  const { current: map } = useMap();
  const callbackRef = useRef(onLongPress);
  useEffect(() => {
    callbackRef.current = onLongPress;
  });

  useEffect(() => {
    if (!map) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number } | null = null;
    // O Chrome do Android dispara contextmenu também no toque longo: evita alfinete duplo.
    let lastFiredAt = 0;

    const fire = (event: PointerLikeEvent) => {
      lastFiredAt = Date.now();
      callbackRef.current({ lat: event.lngLat.lat, lon: event.lngLat.lng });
    };
    const cancel = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
    };
    const onTouchStart = (event: PointerLikeEvent) => {
      cancel();
      const touches = (event.originalEvent as { touches?: { length: number } } | undefined)?.touches;
      if ((touches?.length ?? 1) !== 1) return;
      start = event.point;
      timer = setTimeout(() => {
        timer = null;
        fire(event);
      }, LONG_PRESS_MS);
    };
    const onTouchMove = (event: PointerLikeEvent) => {
      if (!start) return;
      const dx = event.point.x - start.x;
      const dy = event.point.y - start.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
    };
    const onContextMenu = (event: PointerLikeEvent) => {
      event.preventDefault?.();
      if (Date.now() - lastFiredAt < 1000) return;
      cancel();
      fire(event);
    };

    map.on('touchstart', onTouchStart);
    map.on('touchmove', onTouchMove);
    map.on('touchend', cancel);
    map.on('touchcancel', cancel);
    map.on('movestart', cancel);
    map.on('contextmenu', onContextMenu);
    return () => {
      cancel();
      map.off('touchstart', onTouchStart);
      map.off('touchmove', onTouchMove);
      map.off('touchend', cancel);
      map.off('touchcancel', cancel);
      map.off('movestart', cancel);
      map.off('contextmenu', onContextMenu);
    };
  }, [map]);

  return null;
}
