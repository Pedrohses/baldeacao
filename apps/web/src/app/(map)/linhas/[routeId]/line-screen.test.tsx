import { lineShapeExample, routeExample, vehicleSnapshotExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { linesService } from '@/features/lines/services';
import { initialMapState, useMapStore } from '@/features/live-map';
import { vehiclePositionsService } from '@/features/live-map/services';

import { LineScreen } from './line-screen';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/shared/lib/realtime-client', () => ({ subscribePositions: () => () => undefined }));

const mapMock = vi.hoisted(() => ({ layers: [] as { id: string; filter?: unknown }[] }));
vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: ({ id, filter }: { id: string; filter?: unknown }) => {
    mapMock.layers.push({ id, filter });
    return null;
  },
  useMap: () => ({
    current: { on: vi.fn(), off: vi.fn(), fitBounds: vi.fn(), getCanvas: () => ({ style: {} }) },
  }),
}));

vi.mock('@/shared/ui/map', () => ({
  MapLayers: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  UserLocationLayer: () => null,
  useMapColors: () => ({
    brand: '#C7361F',
    brandRgb: '199, 54, 31',
    text: '#000',
    surface: '#fff',
  }),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LineScreen routeId={routeExample.id} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mapMock.layers.length = 0;
  useMapStore.setState(initialMapState);
  vi.spyOn(linesService, 'getDetails').mockResolvedValue({
    line: routeExample,
    shapes: [lineShapeExample],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe('LineScreen', () => {
  it('mostra a linha, conta os ônibus ao vivo dela e destaca a linha no mapa', async () => {
    const spy = vi.spyOn(vehiclePositionsService, 'getSnapshot').mockResolvedValue({
      ...vehicleSnapshotExample,
      routeId: routeExample.id,
    });
    renderScreen();

    expect(await screen.findByRole('heading', { name: routeExample.longName })).toBeInTheDocument();
    const count = vehicleSnapshotExample.vehicles.length;
    expect(
      await screen.findByText(new RegExp(`^${count} ônibus ao vivo agora|^1 ônibus ao vivo`)),
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith(routeExample.id, expect.anything());
    expect(mapMock.layers.some((l) => l.id === 'live-map-vehicles-highlight')).toBe(true);
    expect(mapMock.layers.some((l) => l.id === 'route-shape-0')).toBe(true);
  });

  it('"Ver no mapa" seleciona a linha e abre a aba Mapa', async () => {
    vi.spyOn(vehiclePositionsService, 'getSnapshot').mockResolvedValue({
      ...vehicleSnapshotExample,
      vehicles: [],
    });
    renderScreen();
    expect(
      await screen.findByText('Nenhum ônibus desta linha circulando agora.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver no mapa' }));
    expect(useMapStore.getState().selection).toEqual({ kind: 'line', routeId: routeExample.id });
    expect(push).toHaveBeenCalledWith('/');
  });

  it('metrô e trem não têm posição ao vivo nem contagem de ônibus', async () => {
    vi.spyOn(linesService, 'getDetails').mockResolvedValue({
      line: { ...routeExample, type: 'subway' },
      shapes: [lineShapeExample],
    });
    vi.spyOn(vehiclePositionsService, 'getSnapshot').mockResolvedValue({
      ...vehicleSnapshotExample,
      vehicles: [],
    });
    renderScreen();
    expect(await screen.findByText('Metrô e trem não têm posição ao vivo.')).toBeInTheDocument();
    expect(screen.queryByText(/ônibus ao vivo|Nenhum ônibus/)).not.toBeInTheDocument();
  });
});
