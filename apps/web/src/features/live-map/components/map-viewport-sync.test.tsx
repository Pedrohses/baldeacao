import { act, render } from '@testing-library/react';

import { initialMapState, useMapStore } from '../hooks/use-map-store';
import { createFakeMap } from './fake-map.test-utils';
import { MapViewportSync } from './map-viewport-sync';

const mapRef = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('react-map-gl/maplibre', () => ({ useMap: () => ({ current: mapRef.current }) }));

describe('MapViewportSync', () => {
  beforeEach(() => useMapStore.setState(initialMapState));

  it('grava o viewport no store ao fim do movimento', () => {
    const map = createFakeMap({ lng: -46.66, lat: -23.56, zoom: 14 });
    mapRef.current = map;
    const { unmount } = render(<MapViewportSync />);

    act(() => map.fire('moveend'));

    expect(useMapStore.getState().viewport).toEqual({
      longitude: -46.66,
      latitude: -23.56,
      zoom: 14,
    });
    unmount();
    expect(map.listenerCount('moveend')).toBe(0);
  });
});
