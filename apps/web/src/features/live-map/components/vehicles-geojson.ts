import type { DirectionId, VehiclePosition } from '@baldeacao/types';

export interface VehicleFeatureProperties {
  vehicleId: string;
  routeId: string;
  routeShortName: string;
  directionId: DirectionId;
  accessible: boolean | null;
  recordedAt: string;
}

// Subconjunto do GeoJSON (RFC 7946) que a camada usa; aceito pela fonte do MapLibre.
export interface VehicleFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [lon: number, lat: number] };
  properties: VehicleFeatureProperties;
}

export interface VehiclesFeatureCollection {
  type: 'FeatureCollection';
  features: VehicleFeature[];
}

export function toVehiclesFeatureCollection(
  vehicles: readonly VehiclePosition[],
): VehiclesFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: vehicles.map((vehicle) => ({
      type: 'Feature',
      id: vehicle.vehicleId,
      geometry: { type: 'Point', coordinates: [vehicle.location.lon, vehicle.location.lat] },
      properties: {
        vehicleId: vehicle.vehicleId,
        routeId: vehicle.routeId,
        routeShortName: vehicle.routeShortName,
        directionId: vehicle.directionId,
        accessible: vehicle.accessible,
        recordedAt: vehicle.recordedAt,
      },
    })),
  };
}
