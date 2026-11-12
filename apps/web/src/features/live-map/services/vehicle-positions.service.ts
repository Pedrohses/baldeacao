import { API_PATHS, type VehicleSnapshot, VehicleSnapshotSchema } from '@baldeacao/types';

import { apiGet } from '@/shared/lib/api-client';

export const vehiclePositionsService = {
  /** Snapshot das posições; sem `routeId`, todas as linhas. */
  getSnapshot(routeId?: string, signal?: AbortSignal): Promise<VehicleSnapshot> {
    const query = routeId ? `?${new URLSearchParams({ routeId }).toString()}` : '';
    return apiGet(`${API_PATHS.vehiclePositions}${query}`, VehicleSnapshotSchema, { signal });
  },
};
