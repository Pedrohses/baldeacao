'use client';

import { type CSSProperties, useEffect, useState } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { locate, locateIfPermitted, useGeolocation } from '@/shared/hooks/use-geolocation';

import { LocateIcon } from '../icons';
import { useMapColors } from './map-colors';

export const USER_LOCATION_SOURCE_ID = 'user-location';
export const USER_LOCATION_ZOOM = 15;
export const LOCATE_FAILED_MESSAGE =
  'Não conseguimos sua localização. Ative a permissão de localização do navegador.';
const LOCATE_FAILED_MS = 8000;

// O mapa persiste entre as abas: centralizar no usuário só na primeira abertura, não a cada volta.
let centeredOnce = false;

/** Ponto azul do usuário (anel claro + miolo da marca). Fica dentro do BaseMap. */
export function UserLocationLayer() {
  const { position } = useGeolocation();
  const colors = useMapColors();
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
        paint={{ 'circle-radius': 14, 'circle-color': colors.brand, 'circle-opacity': 0.18 }}
      />
      <Layer
        id="user-location-dot"
        type="circle"
        paint={{
          'circle-radius': 6,
          'circle-color': colors.brand,
          'circle-stroke-color': colors.surface,
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

/**
 * Botão flutuante "Minha localização" (48 px), com aviso acima dele quando não dá para localizar.
 * Fica dentro do BaseMap.
 */
export function LocateButton({ className = '', style, centerOnMount = true }: LocateButtonProps) {
  const { current: map } = useMap();
  const { status } = useGeolocation();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!failed) return;
    const id = setTimeout(() => setFailed(false), LOCATE_FAILED_MS);
    return () => clearTimeout(id);
  }, [failed]);
  useEffect(() => {
    if (!map || !centerOnMount || centeredOnce) return;
    centeredOnce = true;
    void locateIfPermitted().then((position) => {
      if (position) map.jumpTo({ center: [position.lon, position.lat], zoom: USER_LOCATION_ZOOM });
    });
  }, [map, centerOnMount]);

  async function handleClick() {
    setFailed(false);
    const position = await locate();
    // Permissão negada ou GPS indisponível: avisa em vez de não fazer nada.
    if (!position) setFailed(true);
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
    <div
      style={style}
      className={`pointer-events-none absolute z-10 flex flex-col items-end gap-2 ${className}`}
    >
      <p
        role="alert"
        className={
          failed ? 'surface-float pointer-events-auto max-w-64 rounded-md p-3 text-sm' : 'sr-only'
        }
      >
        {failed ? LOCATE_FAILED_MESSAGE : ''}
      </p>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        aria-busy={status === 'locating'}
        className="surface-float pointer-events-auto inline-flex size-12 items-center justify-center rounded-full text-brand-ink"
      >
        <LocateIcon className={`size-6 ${status === 'locating' ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  );
}
