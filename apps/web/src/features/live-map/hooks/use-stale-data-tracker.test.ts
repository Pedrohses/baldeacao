import { REALTIME_STALE_AFTER_MS } from '@baldeacao/types';
import { act, renderHook } from '@testing-library/react';

import { initialMapState, useMapStore } from './use-map-store';
import { STALENESS_CHECK_INTERVAL_MS, useStaleDataTracker } from './use-stale-data-tracker';

const UPDATED_AT = '2026-11-12T15:34:30Z';

describe('useStaleDataTracker', () => {
  beforeEach(() => {
    useMapStore.setState(initialMapState);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(UPDATED_AT));
  });

  afterEach(() => vi.useRealTimers());

  it('passa a marcar atraso quando nenhum dado novo chega', () => {
    renderHook(() => useStaleDataTracker(UPDATED_AT));
    expect(useMapStore.getState()).toMatchObject({ dataUpdatedAt: UPDATED_AT, isStale: false });

    act(() => vi.advanceTimersByTime(REALTIME_STALE_AFTER_MS + STALENESS_CHECK_INTERVAL_MS));

    expect(useMapStore.getState().isStale).toBe(true);
  });

  it('não faz nada sem snapshot', () => {
    renderHook(() => useStaleDataTracker(undefined));
    act(() => vi.advanceTimersByTime(REALTIME_STALE_AFTER_MS * 2));
    expect(useMapStore.getState()).toMatchObject({ dataUpdatedAt: null, isStale: false });
  });
});
