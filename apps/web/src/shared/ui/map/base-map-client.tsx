'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import Map, { AttributionControl, NavigationControl, type ViewState } from 'react-map-gl/maplibre';
import type { ReactNode } from 'react';
import { env } from '@/shared/config/env';

// O MapLibre 6 deduz a URL do worker a partir do próprio arquivo, o que quebra depois do bundle.
// `new URL(..., import.meta.url)` faz o bundler emitir o worker como asset e nos dá a URL final.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

export type MapViewState = Pick<ViewState, 'longitude' | 'latitude' | 'zoom'>;

export interface BaseMapProps {
  initialViewState: MapViewState;
  /** Botões de zoom: só no desktop (no celular o gesto de pinça basta e libera o canto). */
  showNavigation?: boolean;
  /** Camadas (Source/Layer) e controles fornecidos pelas features e pela página. */
  children?: ReactNode;
}

export default function BaseMapClient({
  initialViewState,
  showNavigation = false,
  children,
}: BaseMapProps) {
  return (
    <Map
      initialViewState={initialViewState}
      mapStyle={env.mapStyleUrl}
      style={{ width: '100%', height: '100%' }}
      attributionControl={false}
      // O clique direito vira "soltar alfinete"; girar o mapa com ele confunde.
      dragRotate={false}
      touchPitch={false}
    >
      <AttributionControl compact position={showNavigation ? 'bottom-right' : 'top-right'} />
      {showNavigation ? <NavigationControl position="top-right" showCompass={false} /> : null}
      {children}
    </Map>
  );
}
