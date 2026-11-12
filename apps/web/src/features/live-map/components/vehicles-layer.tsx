'use client';

import type { DataDrivenPropertyValueSpecification, MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { MAP_COLORS } from '@/shared/ui/map';

import { useMapStore } from '../hooks/use-map-store';
import { useStaleDataTracker } from '../hooks/use-stale-data-tracker';
import { useVehiclePositions } from '../hooks/use-vehicle-positions';
import { toVehiclesFeatureCollection } from './vehicles-geojson';

export const VEHICLES_SOURCE_ID = 'live-map-vehicles';
export const VEHICLES_HEATMAP_LAYER_ID = 'live-map-vehicles-heat';
export const VEHICLES_LAYER_ID = 'live-map-vehicles-circle';
export const VEHICLES_HIGHLIGHT_LAYER_ID = 'live-map-vehicles-highlight';

/** Abaixo deste zoom os ônibus viram mancha de calor; acima, pontos. */
export const VEHICLES_POINTS_ZOOM = 13;
// Fade cruzado de 1 nível: heatmap some até 13,5 e os círculos surgem a partir de 12,5.
const FADE_START = VEHICLES_POINTS_ZOOM - 0.5;
const FADE_END = VEHICLES_POINTS_ZOOM + 0.5;
export const DIMMED_VEHICLE_OPACITY = 0.12;

const EMPTY_VEHICLES = toVehiclesFeatureCollection([]);
// Cor da marca (#C7361F) transparente na densidade zero.
const BRAND_RGB = '199, 54, 31';

export interface VehicleHighlight {
  /** route_id da linha em destaque. */
  routeId: string;
  /** Cor da linha em "#RRGGBB". */
  color: string;
}

export interface VehiclesLayerProps {
  /** Linha a acompanhar (route_id); sem ela, todas as linhas. */
  routeId?: string;
  /** Linha selecionada: os ônibus dela ganham a cor da linha e os demais esmaecem. */
  highlight?: VehicleHighlight | null;
}

/** Ônibus em tempo real como uma única fonte GeoJSON (sem um Marker por veículo). */
export function VehiclesLayer({ routeId, highlight = null }: VehiclesLayerProps) {
  const { data } = useVehiclePositions(routeId);
  useStaleDataTracker(data?.updatedAt);
  useSelectVehicleOnClick();

  const selection = useMapStore((state) => state.selection);
  const selectedVehicleId = selection?.kind === 'vehicle' ? selection.vehicleId : '';
  const vehicles = data ? toVehiclesFeatureCollection(data.vehicles) : EMPTY_VEHICLES;
  const isSelected: ['==', ['get', 'vehicleId'], string] = [
    '==',
    ['get', 'vehicleId'],
    selectedVehicleId,
  ];

  const circleOpacity: DataDrivenPropertyValueSpecification<number> = highlight
    ? DIMMED_VEHICLE_OPACITY
    : ['interpolate', ['linear'], ['zoom'], FADE_START, 0, FADE_END, 1];

  return (
    <Source id={VEHICLES_SOURCE_ID} type="geojson" data={vehicles}>
      <Layer
        id={VEHICLES_HEATMAP_LAYER_ID}
        type="heatmap"
        maxzoom={FADE_END}
        layout={{ visibility: highlight ? 'none' : 'visible' }}
        paint={{
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            `rgba(${BRAND_RGB}, 0)`,
            1,
            `rgba(${BRAND_RGB}, 1)`,
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, VEHICLES_POINTS_ZOOM, 14],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], FADE_START, 0.35, FADE_END, 0],
        }}
      />
      <Layer
        id={VEHICLES_LAYER_ID}
        type="circle"
        // Com linha em destaque os demais aparecem (esmaecidos) em qualquer zoom.
        minzoom={highlight ? 0 : FADE_START}
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            VEHICLES_POINTS_ZOOM,
            ['case', isSelected, 5, 2.5],
            17,
            ['case', isSelected, 9, 6],
          ],
          'circle-color': MAP_COLORS.brand,
          'circle-opacity': circleOpacity,
          'circle-stroke-color': ['case', isSelected, MAP_COLORS.text, MAP_COLORS.surface],
          'circle-stroke-width': ['case', isSelected, 3, 1],
          'circle-stroke-opacity': circleOpacity,
        }}
      />
      {highlight ? (
        <Layer
          id={VEHICLES_HIGHLIGHT_LAYER_ID}
          type="circle"
          filter={['==', ['get', 'routeId'], highlight.routeId]}
          paint={{
            'circle-radius': ['case', isSelected, 9, 7],
            'circle-color': highlight.color,
            'circle-stroke-color': ['case', isSelected, MAP_COLORS.text, MAP_COLORS.surface],
            'circle-stroke-width': ['case', isSelected, 3, 2],
          }}
        />
      ) : null}
    </Source>
  );
}

const CLICKABLE_LAYERS = [VEHICLES_LAYER_ID, VEHICLES_HIGHLIGHT_LAYER_ID] as const;

function useSelectVehicleOnClick() {
  const { current: map } = useMap();
  const selectVehicle = useMapStore((state) => state.selectVehicle);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const properties = event.features?.[0]?.properties;
      const vehicleId: unknown = properties?.vehicleId;
      const routeId: unknown = properties?.routeId;
      if (typeof vehicleId === 'string') {
        selectVehicle(vehicleId, typeof routeId === 'string' ? routeId : null);
      }
    };
    const canvas = map.getCanvas();
    const onEnter = () => {
      canvas.style.cursor = 'pointer';
    };
    const onLeave = () => {
      canvas.style.cursor = '';
    };
    for (const layer of CLICKABLE_LAYERS) {
      map.on('click', layer, onClick);
      map.on('mouseenter', layer, onEnter);
      map.on('mouseleave', layer, onLeave);
    }
    return () => {
      for (const layer of CLICKABLE_LAYERS) {
        map.off('click', layer, onClick);
        map.off('mouseenter', layer, onEnter);
        map.off('mouseleave', layer, onLeave);
      }
    };
  }, [map, selectVehicle]);
}
