'use client';

import type { Itinerary } from '@baldeacao/types';
import type { ExpressionSpecification, MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { fitPaddingFor } from '@/shared/ui/map/fit-padding';
import { useMapColors } from '@/shared/ui/map/map-colors';

import { itineraryBounds, itineraryToGeoJson } from '../utils/itinerary-geojson';

export const ITINERARY_SOURCE_ID = 'itinerary';
export const ITINERARY_TRANSIT_CASING_LAYER_ID = 'itinerary-transit-casing';
export const ITINERARY_TRANSIT_LAYER_ID = 'itinerary-transit';
export const ITINERARY_WALK_LAYER_ID = 'itinerary-walk';
export const ITINERARY_TRANSFER_RING_LAYER_ID = 'itinerary-transfer-ring';
export const ITINERARY_STOPS_LAYER_ID = 'itinerary-stops';
export const ITINERARY_ORIGIN_LAYER_ID = 'itinerary-origin';
export const ITINERARY_DESTINATION_LAYER_ID = 'itinerary-destination';
const PIN_IMAGE_PREFIX = 'itinerary-pin-';
const STOP_LAYERS = [ITINERARY_TRANSFER_RING_LAYER_ID, ITINERARY_STOPS_LAYER_ID] as const;

/** Opacidade dos trechos fora de foco quando um trecho é tocado na linha do tempo. */
export const UNFOCUSED_LEG_OPACITY = 0.35;

export type FitPadding = number | { top: number; bottom: number; left: number; right: number };

export interface ItineraryLayerProps {
  /** Itinerário selecionado; null não desenha nada. */
  itinerary: Itinerary | null;
  /** Trecho em destaque (índice em `legs`); null deixa todos iguais. */
  focusedLeg?: number | null;
  /** Folga do enquadramento: o painel cobre parte do mapa. */
  fitPadding?: FitPadding;
  /** Toque num ponto de embarque ou desembarque: índice do trecho dele. */
  onFocusLeg?: (legIndex: number) => void;
}

/** Alfinete na cor da marca, desenhado em canvas (o mapa não carrega ícones externos). */
function drawPin(color: string): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.beginPath();
  ctx.moveTo(24, 62);
  ctx.bezierCurveTo(24, 62, 5, 40, 5, 24);
  ctx.arc(24, 24, 19, Math.PI, 0);
  ctx.bezierCurveTo(43, 40, 24, 62, 24, 62);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(24, 24, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  return ctx.getImageData(0, 0, 48, 64);
}

function legOpacity(focusedLeg: number | null): number | ExpressionSpecification {
  if (focusedLeg === null) return 1;
  return ['case', ['==', ['get', 'legIndex'], focusedLeg], 1, UNFOCUSED_LEG_OPACITY];
}

/**
 * Trechos do itinerário no mapa: transporte na cor da linha (com contorno branco para destacar
 * do mapa) e caminhada tracejada. Enquadra o itinerário ao trocar a seleção. Filha do mapa.
 */
export function ItineraryLayer({
  itinerary,
  focusedLeg = null,
  fitPadding = 64,
  onFocusLeg,
}: ItineraryLayerProps) {
  const { current: map } = useMap();
  const colors = useMapColors();
  const pinId = `${PIN_IMAGE_PREFIX}${colors.brand.slice(1)}`;
  const geojson = useMemo(() => itineraryToGeoJson(itinerary), [itinerary]);

  useEffect(() => {
    if (!map || !itinerary) return;
    const leg = focusedLeg === null ? null : itinerary.legs[focusedLeg];
    const bounds = itineraryBounds(itinerary, leg ? [leg] : undefined);
    if (bounds)
      map.fitBounds(bounds, {
        padding: fitPaddingFor(map, fitPadding),
        maxZoom: 16,
        duration: 600,
      });
  }, [map, itinerary, focusedLeg, fitPadding]);

  // O alfinete entra no mapa ao montar e de novo se o estilo for trocado (tema claro/escuro).
  useEffect(() => {
    if (!map) return;
    // Não depende de isStyleLoaded(): ele fica falso enquanto há tiles carregando e o alfinete
    // podia nunca entrar. Se a camada pedir a imagem antes, o styleimagemissing a fornece.
    const ensurePin = () => {
      if (map.hasImage(pinId)) return;
      const image = drawPin(colors.brand);
      if (!image) return;
      try {
        map.addImage(pinId, image, { pixelRatio: 2 });
      } catch {
        // Estilo ainda não existe; o próximo styledata ou styleimagemissing tenta de novo.
      }
    };
    const onMissing = (event: { id: string }) => {
      if (event.id === pinId) ensurePin();
    };
    ensurePin();
    map.on('styledata', ensurePin);
    map.on('load', ensurePin);
    map.on('styleimagemissing', onMissing);
    return () => {
      map.off('styledata', ensurePin);
      map.off('load', ensurePin);
      map.off('styleimagemissing', onMissing);
    };
  }, [map, pinId, colors.brand]);

  useEffect(() => {
    if (!map || !onFocusLeg) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const legIndex: unknown = event.features?.[0]?.properties?.legIndex;
      if (typeof legIndex === 'number') onFocusLeg(legIndex);
    };
    const canvas = map.getCanvas();
    const onEnter = () => {
      canvas.style.cursor = 'pointer';
    };
    const onLeave = () => {
      canvas.style.cursor = '';
    };
    for (const layer of STOP_LAYERS) {
      map.on('click', layer, onClick);
      map.on('mouseenter', layer, onEnter);
      map.on('mouseleave', layer, onLeave);
    }
    return () => {
      for (const layer of STOP_LAYERS) {
        map.off('click', layer, onClick);
        map.off('mouseenter', layer, onEnter);
        map.off('mouseleave', layer, onLeave);
      }
    };
  }, [map, onFocusLeg]);

  if (!itinerary) return null;
  const opacity = legOpacity(focusedLeg);
  const walkWidth: number | ExpressionSpecification =
    focusedLeg === null ? 4 : ['case', ['==', ['get', 'legIndex'], focusedLeg], 7, 4];

  return (
    <Source id={ITINERARY_SOURCE_ID} type="geojson" data={geojson}>
      <Layer
        id={ITINERARY_TRANSIT_CASING_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#FFFFFF', 'line-width': 9, 'line-opacity': opacity }}
      />
      <Layer
        id={ITINERARY_TRANSIT_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], false]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': ['get', 'color'], 'line-width': 6, 'line-opacity': opacity }}
      />
      <Layer
        id={ITINERARY_WALK_LAYER_ID}
        type="line"
        filter={['==', ['get', 'isWalk'], true]}
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{
          // Cinza-marrom no claro e tom claro no escuro, para não sumir no mapa escuro.
          'line-color': colors.muted,
          'line-width': walkWidth,
          'line-dasharray': [0.5, 2],
          'line-opacity': opacity,
        }}
      />
      <Layer
        id={ITINERARY_TRANSFER_RING_LAYER_ID}
        type="circle"
        filter={['all', ['==', ['get', 'kind'], 'stop'], ['==', ['get', 'transfer'], true]]}
        paint={{
          'circle-radius': 11,
          'circle-color': '#FFFFFF',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-opacity': opacity,
          'circle-stroke-opacity': opacity,
        }}
      />
      <Layer
        id={ITINERARY_STOPS_LAYER_ID}
        type="circle"
        filter={['==', ['get', 'kind'], 'stop']}
        paint={{
          'circle-radius': 6,
          'circle-color': '#FFFFFF',
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-opacity': opacity,
          'circle-stroke-opacity': opacity,
        }}
      />
      <Layer
        id={ITINERARY_ORIGIN_LAYER_ID}
        type="circle"
        filter={['==', ['get', 'kind'], 'origin']}
        paint={{
          'circle-radius': 8,
          'circle-color': colors.surface,
          'circle-stroke-color': colors.text,
          'circle-stroke-width': 4,
        }}
      />
      <Layer
        id={ITINERARY_DESTINATION_LAYER_ID}
        type="symbol"
        filter={['==', ['get', 'kind'], 'destination']}
        layout={{ 'icon-image': pinId, 'icon-anchor': 'bottom', 'icon-allow-overlap': true }}
      />
    </Source>
  );
}
