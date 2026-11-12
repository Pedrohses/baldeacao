import { lineShapeExample, routeExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { linesService } from '../services';
import { LineHeader } from './line-header';
import { RouteShapeLayer } from './route-shape-layer';

const mapMock = vi.hoisted(() => ({
  sources: [] as { id: string; data: unknown }[],
  layers: [] as { id: string; paint: Record<string, unknown> }[],
}));

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ id, data, children }: { id: string; data: unknown; children: ReactNode }) => {
    mapMock.sources.push({ id, data });
    return <>{children}</>;
  },
  Layer: ({ id, paint }: { id: string; paint: Record<string, unknown> }) => {
    mapMock.layers.push({ id, paint });
    return null;
  },
}));

const inbound = {
  ...lineShapeExample,
  directionId: 1 as const,
  shapeId: '84610',
  points: [...lineShapeExample.points].reverse(),
};

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mapMock.sources.length = 0;
  mapMock.layers.length = 0;
  vi.restoreAllMocks();
});

describe('LineHeader', () => {
  it('mostra código, nome e a cor da linha', () => {
    render(<LineHeader line={routeExample} />);
    expect(screen.getByText('875A-10')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Perdizes - Aeroporto' })).toBeInTheDocument();
    expect(screen.getByTestId('line-badge')).toHaveStyle({
      backgroundColor: '#509E2F',
      color: '#FFFFFF',
    });
  });

  it('usa cores padrão quando a linha não tem cor', () => {
    render(<LineHeader line={{ ...routeExample, color: null, textColor: null }} />);
    expect(screen.getByTestId('line-badge')).toHaveStyle({ backgroundColor: '#0B4F5C' });
  });
});

describe('RouteShapeLayer', () => {
  it('transforma o traçado da fixture em camadas, uma feature por sentido', async () => {
    const spy = vi
      .spyOn(linesService, 'getDetails')
      .mockResolvedValue({ line: routeExample, shapes: [lineShapeExample, inbound] });
    wrap(<RouteShapeLayer routeId="875A-10" />);

    await waitFor(() => expect(mapMock.sources.length).toBeGreaterThan(0));
    expect(spy.mock.calls[0]?.[0]).toBe('875A-10');

    const data = mapMock.sources.at(-1)?.data as {
      features: {
        properties: { directionId: number };
        geometry: { type: string; coordinates: number[][] };
      }[];
    };
    expect(data.features).toHaveLength(2);
    expect(data.features[0]?.geometry.type).toBe('LineString');
    expect(data.features[0]?.geometry.coordinates).toEqual([
      [-46.675, -23.535],
      [-46.6685, -23.5455],
    ]);
    expect(data.features.map((f) => f.properties.directionId)).toEqual([0, 1]);
    expect(mapMock.layers.map((l) => l.id)).toEqual(['route-shape-0', 'route-shape-1']);
    expect(mapMock.layers[0]?.paint['line-color']).toBe('#509E2F');
  });

  it('não desenha nem consulta sem routeId', () => {
    const spy = vi.spyOn(linesService, 'getDetails');
    wrap(<RouteShapeLayer routeId={null} />);
    expect(spy).not.toHaveBeenCalled();
    expect(mapMock.sources).toHaveLength(0);
  });
});
