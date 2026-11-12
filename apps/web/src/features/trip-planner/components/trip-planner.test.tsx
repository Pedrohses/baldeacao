import type { Itinerary, TripRequest } from '@baldeacao/types';
import { itineraryExample, tripRequestExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTripPlan } from '../hooks';
import { tripPlannerService } from '../services';
import { ItineraryLayer } from './itinerary-layer';
import { ItineraryList, type ItineraryListStatus } from './itinerary-list';

const mapMock = vi.hoisted(() => ({
  sources: [] as { id: string; data: unknown }[],
  layers: [] as { id: string; filter: unknown; paint: Record<string, unknown> }[],
  fitBounds: vi.fn(),
}));

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ id, data, children }: { id: string; data: unknown; children: ReactNode }) => {
    mapMock.sources.push({ id, data });
    return <>{children}</>;
  },
  Layer: ({
    id,
    filter,
    paint,
  }: {
    id: string;
    filter: unknown;
    paint: Record<string, unknown>;
  }) => {
    mapMock.layers.push({ id, filter, paint });
    return null;
  },
  useMap: () => ({ current: { fitBounds: mapMock.fitBounds } }),
}));

interface LegsCollection {
  features: {
    properties: { legIndex: number; mode: string; isWalk: boolean; color: string };
    geometry: { type: string; coordinates: number[][] };
  }[];
}

const directBus: Itinerary = {
  ...itineraryExample,
  startAt: '2026-11-12T08:10:00-03:00',
  endAt: '2026-11-12T09:20:00-03:00',
  durationS: 4200,
  transfers: 0,
  legs: [itineraryExample.legs[1]!],
};

/** Mesma composição da página: hook alimenta a lista e o item selecionado vira camada. */
function Harness({ request }: { request: TripRequest | null }) {
  const plan = useTripPlan(request);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const status: ItineraryListStatus = !request
    ? 'idle'
    : plan.isPending
      ? 'loading'
      : plan.isError
        ? 'error'
        : 'success';
  const itineraries = plan.data ?? [];
  return (
    <>
      <ItineraryList
        status={status}
        itineraries={itineraries}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        {...(plan.error ? { errorMessage: plan.error.message } : {})}
      />
      <ItineraryLayer itinerary={itineraries[selectedIndex] ?? null} />
    </>
  );
}

function renderHarness(request: TripRequest | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness request={request} />
    </QueryClientProvider>,
  );
}

function lastLegs(): LegsCollection {
  return mapMock.sources.at(-1)?.data as LegsCollection;
}

beforeEach(() => {
  mapMock.sources.length = 0;
  mapMock.layers.length = 0;
  mapMock.fitBounds.mockReset();
  vi.restoreAllMocks();
});

describe('planejamento de viagem', () => {
  it('o itinerário de fixture aparece na lista e vira camadas no mapa', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([itineraryExample]);
    renderHarness(tripRequestExample);

    expect(screen.getByRole('status')).toHaveTextContent('Procurando itinerários...');
    const option = await screen.findByRole('button', { name: /08:00 até 09:04/ });
    expect(spy.mock.calls[0]?.[0]).toEqual(tripRequestExample);

    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(option).toHaveTextContent('1 h 4 min');
    expect(option).toHaveTextContent('1 baldeação, 650 m a pé');
    const badges = within(option).getAllByTestId('leg-badge');
    expect(badges.map((b) => b.textContent)).toEqual(['Ônibus7725-10', 'MetrôL4 e L1']);
    expect(badges[0]).toHaveStyle({ backgroundColor: '#509E2F' });
    expect(badges[1]).toHaveStyle({ backgroundColor: '#FFD700', color: '#000000' });

    expect(screen.getByRole('heading', { name: 'Trechos do itinerário 1' })).toBeInTheDocument();
    expect(screen.getByText('Caminhe 350 m até Av. Giovanni Gronchi')).toBeInTheDocument();
    expect(screen.getByText('Ônibus 7725-10 sentido Rio Pequeno')).toBeInTheDocument();
    expect(screen.getByText(/08:07 até 08:25, 18 min, 9 paradas/)).toBeInTheDocument();

    const data = lastLegs();
    expect(mapMock.sources.at(-1)?.id).toBe('itinerary');
    expect(data.features).toHaveLength(4);
    expect(data.features.map((f) => f.properties.mode)).toEqual(['walk', 'bus', 'subway', 'walk']);
    expect(data.features.map((f) => f.properties.color)).toEqual([
      '#525252',
      '#509E2F',
      '#FFD700',
      '#525252',
    ]);
    expect(data.features[1]?.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-46.7225, -23.6012],
        [-46.7081, -23.5719],
      ],
    });

    const layers = mapMock.layers.slice(-3);
    expect(layers.map((l) => l.id)).toEqual([
      'itinerary-transit-casing',
      'itinerary-transit',
      'itinerary-walk',
    ]);
    expect(layers[1]?.paint['line-color']).toEqual(['get', 'color']);
    expect(layers[2]?.filter).toEqual(['==', ['get', 'isWalk'], true]);
    expect(layers[2]?.paint['line-dasharray']).toBeDefined();
    expect(layers[1]?.paint['line-dasharray']).toBeUndefined();

    expect(mapMock.fitBounds).toHaveBeenCalledWith(
      [
        [-46.7225, -23.6012],
        [-46.6249, -23.5163],
      ],
      expect.objectContaining({ padding: 64 }),
    );
  });

  it('trocar de itinerário redesenha o mapa com os trechos escolhidos', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([itineraryExample, directBus]);
    renderHarness(tripRequestExample);

    const second = await screen.findByRole('button', { name: /08:10 até 09:20/ });
    expect(second).toHaveTextContent('Sem baldeação');
    fireEvent.click(second);

    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Trechos do itinerário 2' })).toBeInTheDocument();
    expect(lastLegs().features.map((f) => f.properties.mode)).toEqual(['bus']);
  });

  it('mostra estado vazio e de erro', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([]);
    const { unmount } = renderHarness(tripRequestExample);
    expect(
      await screen.findByText('Nenhum itinerário encontrado para esse trajeto.'),
    ).toBeInTheDocument();
    expect(mapMock.sources).toHaveLength(0);
    unmount();

    spy.mockRejectedValue(
      new Error('O planejador está com problemas. Tente de novo em instantes.'),
    );
    renderHarness(tripRequestExample);
    expect(await screen.findByRole('alert')).toHaveTextContent('O planejador está com problemas');
  });

  it('sem pedido não consulta nem desenha', () => {
    const spy = vi.spyOn(tripPlannerService, 'plan');
    const { container } = renderHarness(null);
    expect(spy).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
    expect(mapMock.sources).toHaveLength(0);
    expect(mapMock.fitBounds).not.toHaveBeenCalled();
  });
});
