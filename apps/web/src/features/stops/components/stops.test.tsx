import { arrivalExample, stopExample } from '@baldeacao/types/examples';
import type { NearbyStop } from '@baldeacao/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { stopsService } from '../services';
import { ArrivalsList, ArrivalsListView } from './arrivals-list';
import { StopSheet } from './stop-sheet';
import { StopsLayer } from './stops-layer';

const mapMock = vi.hoisted(() => ({
  sources: [] as { id: string; data: unknown }[],
  layers: [] as { id: string }[],
  handlers: new Map<string, (event: unknown) => void>(),
}));

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ id, data, children }: { id: string; data: unknown; children: ReactNode }) => {
    mapMock.sources.push({ id, data });
    return <>{children}</>;
  },
  Layer: ({ id }: { id: string }) => {
    mapMock.layers.push({ id });
    return null;
  },
  useMap: () => ({
    current: {
      on: (type: string, _layer: string, handler: (event: unknown) => void) =>
        mapMock.handlers.set(type, handler),
      off: vi.fn(),
      getCanvas: () => ({ style: {} }),
    },
  }),
}));

const nearby: NearbyStop = { ...stopExample, distanceM: 120 };

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mapMock.sources.length = 0;
  mapMock.layers.length = 0;
  mapMock.handlers.clear();
  vi.restoreAllMocks();
});

describe('ArrivalsListView', () => {
  const now = new Date('2026-11-12T15:31:00Z');

  it('mostra minutos e indica tempo real', () => {
    render(<ArrivalsListView arrivals={[arrivalExample]} now={now} />);
    expect(screen.getByText('875A-10')).toBeInTheDocument();
    expect(screen.getByText('Aeroporto')).toBeInTheDocument();
    expect(screen.getByText('5 min')).toBeInTheDocument();
    expect(screen.getByText('Tempo real')).toBeInTheDocument();
  });

  it('indica tabela quando não é tempo real', () => {
    render(
      <ArrivalsListView arrivals={[{ ...arrivalExample, isRealtime: false }]} now={now} />,
    );
    expect(screen.getByText('Tabela')).toBeInTheDocument();
  });

  it('mostra mensagem quando não há chegadas', () => {
    render(<ArrivalsListView arrivals={[]} now={now} />);
    expect(screen.getByText(/Nenhuma chegada prevista/)).toBeInTheDocument();
  });
});

describe('ArrivalsList', () => {
  it('busca as chegadas da parada pelo service', async () => {
    const spy = vi
      .spyOn(stopsService, 'getArrivals')
      .mockResolvedValue({ stopId: stopExample.id, arrivals: [arrivalExample] });
    wrap(<ArrivalsList stopId={stopExample.id} />);
    expect(await screen.findByText('875A-10')).toBeInTheDocument();
    expect(spy.mock.calls[0]?.[0]).toBe(stopExample.id);
  });

  it('mostra erro quando o service falha', async () => {
    vi.spyOn(stopsService, 'getArrivals').mockRejectedValue(new Error('falhou'));
    wrap(<ArrivalsList stopId={stopExample.id} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
  });
});

describe('StopSheet', () => {
  it('mostra a parada, as chegadas e fecha pelo botão', async () => {
    vi.spyOn(stopsService, 'getArrivals').mockResolvedValue({
      stopId: stopExample.id,
      arrivals: [arrivalExample],
    });
    const onClose = vi.fn();
    wrap(<StopSheet stop={stopExample} onClose={onClose} />);
    expect(screen.getByRole('heading', { name: 'Av. Paulista 1578' })).toBeInTheDocument();
    expect(await screen.findByText('875A-10')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Fechar/ }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('StopsLayer', () => {
  it('vira camada GeoJSON com [lon, lat] e devolve a parada tocada', async () => {
    vi.spyOn(stopsService, 'getNearby').mockResolvedValue({ stops: [nearby] });
    const onSelectStop = vi.fn();
    wrap(<StopsLayer center={{ lat: -23.56, lon: -46.65 }} onSelectStop={onSelectStop} />);

    await waitFor(() => {
      const data = mapMock.sources.at(-1)?.data as { features: unknown[] };
      expect(data.features).toHaveLength(1);
    });
    const data = mapMock.sources.at(-1)?.data as {
      features: { geometry: { coordinates: number[] } }[];
    };
    expect(data.features[0]?.geometry.coordinates).toEqual([-46.6559, -23.5614]);
    expect(mapMock.layers.map((l) => l.id)).toContain('stops-circles');

    mapMock.handlers.get('click')?.({ features: [{ properties: { id: stopExample.id } }] });
    expect(onSelectStop).toHaveBeenCalledWith(nearby);
  });

  it('não consulta sem centro', () => {
    const spy = vi.spyOn(stopsService, 'getNearby');
    wrap(<StopsLayer center={null} onSelectStop={vi.fn()} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
