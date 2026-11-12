import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LONG_PRESS_MS, MapLongPress } from './map-long-press';

type Handler = (event?: unknown) => void;
const handlers = vi.hoisted(() => new Map<string, Handler>());

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({
    current: {
      on: (type: string, handler: Handler) => handlers.set(type, handler),
      off: (type: string) => handlers.delete(type),
    },
  }),
}));

const at = (x: number, y: number) => ({
  lngLat: { lng: -46.63, lat: -23.55 },
  point: { x, y },
  originalEvent: { touches: { length: 1 } },
  preventDefault: vi.fn(),
});

beforeEach(() => {
  handlers.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('MapLongPress', () => {
  it('segurar o dedo parado entrega a coordenada', () => {
    const onLongPress = vi.fn();
    render(<MapLongPress onLongPress={onLongPress} />);

    act(() => handlers.get('touchstart')?.(at(10, 10)));
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledWith({ lat: -23.55, lon: -46.63 });
  });

  it('arrastar ou soltar antes do tempo cancela', () => {
    const onLongPress = vi.fn();
    render(<MapLongPress onLongPress={onLongPress} />);

    act(() => handlers.get('touchstart')?.(at(10, 10)));
    act(() => handlers.get('touchmove')?.(at(40, 10)));
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    act(() => handlers.get('touchstart')?.(at(10, 10)));
    act(() => handlers.get('touchend')?.());
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('clique direito entrega a coordenada uma vez (sem duplicar o toque longo)', () => {
    const onLongPress = vi.fn();
    const { unmount } = render(<MapLongPress onLongPress={onLongPress} />);

    act(() => handlers.get('contextmenu')?.(at(5, 5)));
    expect(onLongPress).toHaveBeenCalledTimes(1);

    act(() => handlers.get('touchstart')?.(at(10, 10)));
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
    act(() => handlers.get('contextmenu')?.(at(10, 10)));
    expect(onLongPress).toHaveBeenCalledTimes(2);

    unmount();
    expect(handlers.size).toBe(0);
  });
});
