'use client';

import type { MapLayerMouseEvent } from 'maplibre-gl';
import { useEffect } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { useMapStore } from '../hooks/use-map-store';
import { useStaleDataTracker } from '../hooks/use-stale-data-tracker';
import { useVehiclePositions } from '../hooks/use-vehicle-positions';
import { toVehiclesFeatureCollection } from './vehicles-geojson';

export const VEHICLES_SOURCE_ID = 'live-map-vehicles';
export const VEHICLES_LAYER_ID = 'live-map-vehicles-circle';

const EMPTY_VEHICLES = toVehiclesFeatureCollection([]);

export interface VehiclesLayerProps {
  /** Linha a acompanhar (route_id); sem ela, todas as linhas. */
  routeId?: string;
}

/** Ônibus em tempo real como uma única fonte GeoJSON (sem um Marker por veículo). */
export function VehiclesLayer({ routeId }: VehiclesLayerProps) {
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

  return (
    <Source id={VEHICLES_SOURCE_ID} type="geojson" data={vehicles}>
      <Layer
        id={VEHICLES_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            ['case', isSelected, 6, 3],
            15,
            ['case', isSelected, 11, 7],
          ],
          'circle-color': '#d4001a',
          'circle-stroke-color': ['case', isSelected, '#111827', '#ffffff'],
          'circle-stroke-width': ['case', isSelected, 3, 1.5],
        }}
      />
    </Source>
  );
}

function useSelectVehicleOnClick() {
  const { current: map } = useMap();
  const selectVehicle = useMapStore((state) => state.selectVehicle);

  useEffect(() => {
    if (!map) return;
    const onClick = (event: MapLayerMouseEvent) => {
      const vehicleId: unknown = event.features?.[0]?.properties?.vehicleId;
      if (typeof vehicleId === 'string') selectVehicle(vehicleId);
    };
    const canvas = map.getCanvas();
    const onEnter = () => {
      canvas.style.cursor = 'pointer';
    };
    const onLeave = () => {
      canvas.style.cursor = '';
    };
    map.on('click', VEHICLES_LAYER_ID, onClick);
    map.on('mouseenter', VEHICLES_LAYER_ID, onEnter);
    map.on('mouseleave', VEHICLES_LAYER_ID, onLeave);
    return () => {
      map.off('click', VEHICLES_LAYER_ID, onClick);
      map.off('mouseenter', VEHICLES_LAYER_ID, onEnter);
      map.off('mouseleave', VEHICLES_LAYER_ID, onLeave);
    };
  }, [map, selectVehicle]);
}
