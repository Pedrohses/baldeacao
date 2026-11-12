'use client';

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { useMapStore } from '../hooks/use-map-store';

/** Sem UI: leva o viewport do mapa para o store ao fim de cada movimento. Fica dentro do BaseMap. */
export function MapViewportSync() {
  const { current: map } = useMap();
  const setViewport = useMapStore((state) => state.setViewport);

  useEffect(() => {
    if (!map) return;
    const onMoveEnd = () => {
      const { lng, lat } = map.getCenter();
      setViewport({ longitude: lng, latitude: lat, zoom: map.getZoom() });
    };
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [map, setViewport]);

  return null;
}
