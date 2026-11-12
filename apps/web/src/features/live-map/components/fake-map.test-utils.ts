// Mapa falso para testes de componentes que usam useMap: registra handlers e permite dispará-los.
type Handler = (event?: unknown) => void;

export function createFakeMap(view = { lng: -46.63, lat: -23.55, zoom: 11 }) {
  const handlers = new Map<string, Set<Handler>>();
  const keyOf = (type: string, layerOrHandler: unknown) =>
    typeof layerOrHandler === 'string' ? `${type}:${layerOrHandler}` : type;
  const canvas = { style: { cursor: '' } };

  return {
    canvas,
    view,
    on: vi.fn((type: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
      const key = keyOf(type, layerOrHandler);
      const handler = (maybeHandler ?? layerOrHandler) as Handler;
      const set = handlers.get(key) ?? new Set();
      set.add(handler);
      handlers.set(key, set);
    }),
    off: vi.fn((type: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
      const handler = (maybeHandler ?? layerOrHandler) as Handler;
      handlers.get(keyOf(type, layerOrHandler))?.delete(handler);
    }),
    fire(key: string, event?: unknown) {
      for (const handler of handlers.get(key) ?? []) handler(event);
    },
    listenerCount(key: string) {
      return handlers.get(key)?.size ?? 0;
    },
    getCanvas: () => canvas,
    getCenter: () => ({ lng: view.lng, lat: view.lat }),
    getZoom: () => view.zoom,
  };
}

export type FakeMap = ReturnType<typeof createFakeMap>;
