'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl, type Map as MapLibreMap } from 'maplibre-gl';
import Map, {
  AttributionControl,
  NavigationControl,
  type MapRef,
  type ViewState,
} from 'react-map-gl/maplibre';
import type { ReactNode } from 'react';

import { MAP_STYLE_URLS, useMapTheme } from './map-colors';

// O MapLibre 6 deduz a URL do worker a partir do próprio arquivo, o que quebra depois do bundle.
// `new URL(..., import.meta.url)` faz o bundler emitir o worker como asset e nos dá a URL final.
setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href);

// 1x1 transparente para imagens que o estilo cita e não traz (ex.: "wood-pattern" no escuro).
const EMPTY_IMAGE = { width: 1, height: 1, data: new Uint8Array(4) };
const patched = new WeakSet<MapLibreMap>();

/**
 * Sem isso o MapLibre avisa no console a cada imagem ausente do estilo. No MapLibre 6 o aviso sai
 * antes do evento `styleimagemissing`; só o resolver chega a tempo. O evento fica de reserva.
 */
function ignoreMissingImages(ref: MapRef | null) {
  const map = ref?.getMap();
  if (!map || patched.has(map)) return;
  patched.add(map);
  const addEmpty = (id: string) => {
    if (!map.hasImage(id)) map.addImage(id, EMPTY_IMAGE);
  };
  map.setMissingStyleImageResolver(addEmpty);
  map.on('styleimagemissing', ({ id }: { id: string }) => addEmpty(id));
}

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
  const theme = useMapTheme();
  return (
    <Map
      ref={ignoreMissingImages}
      initialViewState={initialViewState}
      mapStyle={MAP_STYLE_URLS[theme]}
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
