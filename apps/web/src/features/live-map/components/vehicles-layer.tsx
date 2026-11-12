'use client';

import { Layer, Source } from 'react-map-gl/maplibre';

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
  const vehicles = data ? toVehiclesFeatureCollection(data.vehicles) : EMPTY_VEHICLES;

  return (
    <Source id={VEHICLES_SOURCE_ID} type="geojson" data={vehicles}>
      <Layer
        id={VEHICLES_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 15, 7],
          'circle-color': '#d4001a',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        }}
      />
    </Source>
  );
}
