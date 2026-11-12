'use client';

import { type CSSProperties, useEffect, useRef } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { locate, locateIfPermitted, useGeolocation } from '@/shared/hooks/use-geolocation';

import { LocateIcon } from '../icons';
import { MAP_COLORS } from './map-colors';

export const USER_LOCATION_SOURCE_ID = 'user-location';
export const USER_LOCATION_ZOOM = 15;

/** Ponto azul do usuário (anel claro + miolo da marca). Fica dentro do BaseMap. */
export function UserLocationLayer() {
  const { position } = useGeolocation();
  if (!position) return null;
  return (
    <Source
      id={USER_LOCATION_SOURCE_ID}
      type="geojson"
      data={{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: [position.lon, position.lat] },
      }}
    >
      <Layer
        id="user-location-halo"
        type="circle"
        paint={{ 'circle-radius': 14, 'circle-color': MAP_COLORS.brand, 'circle-opacity': 0.18 }}
      />
      <Layer
        id="user-location-dot"
        type="circle"
        paint={{
          'circle-radius': 6,
          'circle-color': MAP_COLORS.brand,
          'circle-stroke-color': MAP_COLORS.surface,
          'circle-stroke-width': 2,
        }}
      />
    </Source>
  );
}

export interface LocateButtonProps {
  /** Classes de posição (o painel muda de altura no celular). */
  className?: string;
  style?: CSSProperties;
  /** Na abertura do mapa, centraliza no usuário se a permissão já foi dada. */
  centerOnMount?: boolean;
}

/** Botão flutuante "Minha localização" (48 px). Fica dentro do BaseMap. */
export function LocateButton({
  className = '',
  style,
  centerOnMount = true,
}: LocateButtonProps) {
  const { current: map } = useMap();
  const { status } = useGeolocation();
  const centeredRef = useRef(false);

  useEffect(() => {
    if (!map || !centerOnMount || centeredRef.current) return;
    centeredRef.current = true;
    void locateIfPermitted().then((position) => {
      if (position) map.jumpTo({ center: [position.lon, position.lat], zoom: USER_LOCATION_ZOOM });
    });
  }, [map, centerOnMount]);

  async function handleClick() {
    const position = await locate();
    if (position && map) {
      map.flyTo({
        center: [position.lon, position.lat],
        zoom: Math.max(map.getZoom(), USER_LOCATION_ZOOM),
        duration: 600,
      });
    }
  }

  const label =
    status === 'denied'
      ? 'Minha localização (permissão negada no navegador)'
      : status === 'locating'
        ? 'Buscando sua localização'
        : 'Minha localização';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      title={label}
      aria-busy={status === 'locating'}
      style={style}
      className={`surface-float absolute z-10 inline-flex size-12 items-center justify-center rounded-full text-brand ${className}`}
    >
      <LocateIcon className={`size-6 ${status === 'locating' ? 'animate-pulse' : ''}`} />
    </button>
  );
}
