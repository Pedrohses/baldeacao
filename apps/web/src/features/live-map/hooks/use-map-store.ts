import { isSnapshotStale } from '@baldeacao/types';
import { create } from 'zustand';

import type { MapViewState } from '@/shared/ui/map';

// Centro de São Paulo (Praça da Sé).
export const DEFAULT_MAP_VIEWPORT: MapViewState = {
  longitude: -46.6339,
  latitude: -23.5503,
  zoom: 11,
};

export type MapSelection =
  | { kind: 'vehicle'; vehicleId: string }
  | { kind: 'stop'; stopId: string }
  | null;

export interface MapStateData {
  viewport: MapViewState;
  selection: MapSelection;
  /** `updatedAt` do último snapshot de posições recebido (API ou socket). */
  dataUpdatedAt: string | null;
  /** Fonte de tempo real sem dado novo há mais de REALTIME_STALE_AFTER_MS. */
  isStale: boolean;
}

export interface MapStateActions {
  setViewport(viewport: MapViewState): void;
  selectVehicle(vehicleId: string): void;
  selectStop(stopId: string): void;
  clearSelection(): void;
  /** Registra o `updatedAt` de um snapshot e recalcula `isStale`. */
  reportDataUpdatedAt(updatedAt: string, now?: Date): void;
  /** Recalcula `isStale` com o relógio atual; chamado periodicamente. */
  checkStaleness(now?: Date): void;
}

export type MapState = MapStateData & MapStateActions;

export const initialMapState: MapStateData = {
  viewport: DEFAULT_MAP_VIEWPORT,
  selection: null,
  dataUpdatedAt: null,
  isStale: false,
};

function staleFor(updatedAt: string | null, now: Date): boolean {
  return updatedAt !== null && isSnapshotStale({ updatedAt }, now);
}

export const useMapStore = create<MapState>()((set, get) => ({
  ...initialMapState,

  setViewport: (viewport) => set({ viewport }),
  selectVehicle: (vehicleId) => set({ selection: { kind: 'vehicle', vehicleId } }),
  selectStop: (stopId) => set({ selection: { kind: 'stop', stopId } }),
  clearSelection: () => set({ selection: null }),

  reportDataUpdatedAt: (updatedAt, now = new Date()) =>
    set({ dataUpdatedAt: updatedAt, isStale: staleFor(updatedAt, now) }),

  checkStaleness: (now = new Date()) => {
    const isStale = staleFor(get().dataUpdatedAt, now);
    if (isStale !== get().isStale) set({ isStale });
  },
}));
