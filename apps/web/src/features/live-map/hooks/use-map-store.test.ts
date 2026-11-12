import { REALTIME_STALE_AFTER_MS } from '@baldeacao/types';

import { DEFAULT_MAP_VIEWPORT, initialMapState, useMapStore } from './use-map-store';

const UPDATED_AT = '2026-11-12T15:34:30Z';
const at = (offsetMs: number) => new Date(Date.parse(UPDATED_AT) + offsetMs);

describe('useMapStore', () => {
  beforeEach(() => useMapStore.setState(initialMapState));

  it('começa no centro de São Paulo, sem seleção e sem atraso', () => {
    const state = useMapStore.getState();
    expect(state.viewport).toEqual(DEFAULT_MAP_VIEWPORT);
    expect(state.selection).toBeNull();
    expect(state.dataUpdatedAt).toBeNull();
    expect(state.isStale).toBe(false);
  });

  it('guarda o viewport', () => {
    useMapStore.getState().setViewport({ longitude: -46.7, latitude: -23.6, zoom: 15 });
    expect(useMapStore.getState().viewport).toEqual({ longitude: -46.7, latitude: -23.6, zoom: 15 });
  });

  it('seleciona veículo ou parada, uma de cada vez, e limpa a seleção', () => {
    const { selectVehicle, selectStop, clearSelection } = useMapStore.getState();

    selectVehicle('11433', '875A-10');
    expect(useMapStore.getState().selection).toEqual({
      kind: 'vehicle',
      vehicleId: '11433',
      routeId: '875A-10',
    });

    selectStop('4301848');
    expect(useMapStore.getState().selection).toEqual({ kind: 'stop', stopId: '4301848' });

    clearSelection();
    expect(useMapStore.getState().selection).toBeNull();
  });

  it('marca dados atrasados pelo isSnapshotStale do contrato', () => {
    const { reportDataUpdatedAt, checkStaleness } = useMapStore.getState();

    reportDataUpdatedAt(UPDATED_AT, at(REALTIME_STALE_AFTER_MS));
    expect(useMapStore.getState().isStale).toBe(false);

    checkStaleness(at(REALTIME_STALE_AFTER_MS + 1));
    expect(useMapStore.getState().isStale).toBe(true);

    // Um ciclo novo tira o aviso.
    reportDataUpdatedAt(at(REALTIME_STALE_AFTER_MS).toISOString(), at(REALTIME_STALE_AFTER_MS + 1));
    expect(useMapStore.getState().isStale).toBe(false);
  });

  it('não marca atraso antes de receber o primeiro snapshot', () => {
    useMapStore.getState().checkStaleness(at(10 * REALTIME_STALE_AFTER_MS));
    expect(useMapStore.getState().isStale).toBe(false);
  });
});
