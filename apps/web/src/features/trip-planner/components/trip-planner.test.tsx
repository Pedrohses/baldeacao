import type { Itinerary, PlanTripNotice, TripRequest } from '@baldeacao/types';
import { itineraryExample, tripRequestExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTripPlan } from '../hooks';
import { tripPlannerService } from '../services';
import { ItineraryLayer } from './itinerary-layer';
import { ItineraryList, type ItineraryListStatus } from './itinerary-list';
import { ItineraryTimeline } from './itinerary-timeline';
import { WALK_COLOR } from '../utils/format';

const planned = (itineraries: Itinerary[], notices: PlanTripNotice[] = []) => ({
  itineraries,
  notices,
});

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
  useMap: () => ({
    current: {
      fitBounds: mapMock.fitBounds,
      on: vi.fn(),
      off: vi.fn(),
      hasImage: vi.fn(() => false),
      isStyleLoaded: vi.fn(() => false),
      getCanvas: () => ({ style: {} }),
    },
  }),
}));

interface LegsCollection {
  features: {
    properties: { legIndex: number; mode: string; isWalk: boolean; color: string };
    geometry: { type: string; coordinates: number[][] };
  }[];
}

// 4 min antes da saída do itinerário de fixture (08:00 em São Paulo).
const NOW = new Date('2026-11-12T07:56:00-03:00');
const PADDING = { top: 64, bottom: 64, left: 448, right: 64 };

const directBus: Itinerary = {
  ...itineraryExample,
  startAt: '2026-11-12T08:10:00-03:00',
  endAt: '2026-11-12T09:20:00-03:00',
  durationS: 4200,
  transfers: 0,
  legs: [itineraryExample.legs[1]!],
};

const metroL4: Itinerary = {
  ...itineraryExample,
  startAt: '2026-11-12T07:57:00-03:00',
  legs: [{ ...itineraryExample.legs[2]!, routeShortName: 'METRÔ L4', isRealtime: false }],
};

/** Mesma composição da página: hook alimenta a lista e o item selecionado vira camada. */
function Harness({ request }: { request: TripRequest | null }) {
  const plan = useTripPlan(request);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedLeg, setFocusedLeg] = useState<number | null>(null);
  const status: ItineraryListStatus = !request
    ? 'idle'
    : plan.isPending
      ? 'loading'
      : plan.isError
        ? 'error'
        : 'success';
  const itineraries = plan.data?.itineraries ?? [];
  const selected = itineraries[selectedIndex] ?? null;
  return (
    <>
      <ItineraryList
        status={status}
        itineraries={itineraries}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        now={NOW}
        onRetry={() => void plan.refetch()}
        {...(plan.error ? { errorMessage: plan.error.message } : {})}
      />
      {selected ? (
        <ItineraryTimeline
          itinerary={selected}
          focusedLeg={focusedLeg}
          onFocusLeg={setFocusedLeg}
          destinationName="Terminal Rodoviário Tietê"
        />
      ) : null}
      <ItineraryLayer itinerary={selected} focusedLeg={focusedLeg} fitPadding={PADDING} />
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
  const data = mapMock.sources.at(-1)?.data as LegsCollection;
  return { features: data.features.filter((f) => f.geometry.type === 'LineString') };
}

beforeEach(() => {
  mapMock.sources.length = 0;
  mapMock.layers.length = 0;
  mapMock.fitBounds.mockReset();
  vi.restoreAllMocks();
});

describe('marcadores do itinerário', () => {
  it('põe origem, destino e pontos de embarque e desembarque', () => {
    render(<ItineraryLayer itinerary={directBus} fitPadding={PADDING} />);
    const data = mapMock.sources.at(-1)?.data as {
      features: { properties: { kind?: string }; geometry: { type: string } }[];
    };
    const kinds = data.features
      .filter((f) => f.geometry.type === 'Point')
      .map((f) => f.properties.kind);
    expect(kinds.filter((k) => k === 'origin')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'destination')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'stop').length).toBeGreaterThanOrEqual(2);
    const ids = mapMock.layers.map((l) => l.id);
    expect(ids.indexOf('itinerary-walk')).toBeLessThan(ids.indexOf('itinerary-stops'));
    expect(ids.indexOf('itinerary-stops')).toBeLessThan(ids.indexOf('itinerary-origin'));
  });

  it('caminhada fica mais larga quando focada', () => {
    render(<ItineraryLayer itinerary={directBus} focusedLeg={0} fitPadding={PADDING} />);
    const walk = mapMock.layers.findLast((l) => l.id === 'itinerary-walk');
    expect(walk?.paint['line-width']).not.toBe(4);
  });
});

describe('cartão de itinerário', () => {
  it('mostra horários, duração, linhas e o resumo "Sai em"', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([itineraryExample]));
    renderHarness(tripRequestExample);

    expect(screen.getByRole('status')).toHaveTextContent('Procurando itinerários...');
    const option = await screen.findByRole('button', { name: /Das 08:00 às 09:04/ });
    expect(spy.mock.calls[0]?.[0]).toEqual(tripRequestExample);

    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(option).toHaveTextContent('08:00 → 09:04');
    expect(option).toHaveTextContent('1 h 4 min');
    expect(option).toHaveTextContent('Sai em 4 min');
    expect(option).toHaveTextContent('1 baldeação');
    expect(option).toHaveTextContent('650 m a pé');
    expect(option).toHaveTextContent('ao vivo');

    // Só os trechos de transporte viram selo; a caminhada fica na barra.
    const badges = within(option).getAllByTestId('leg-badge');
    expect(badges.map((b) => b.textContent)).toEqual(['Ônibus 7725-10', 'Metrô L4 e L1']);
    expect(badges[0]).toHaveStyle({ backgroundColor: '#509E2F' });
    expect(badges[1]).toHaveStyle({ backgroundColor: '#FFD700', color: '#000000' });
    expect(within(option).getAllByTestId('leg-bar-segment')).toHaveLength(4);
  });

  it('encurta "METRÔ L4" para "L4" e mostra "Sai agora" a menos de 2 min', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([metroL4]));
    renderHarness(tripRequestExample);

    const option = await screen.findByRole('button', { name: /Das 07:57/ });
    expect(within(option).getByTestId('leg-badge')).toHaveTextContent(/^Metrô L4$/);
    expect(option).toHaveTextContent('Sai agora');
    expect(option).not.toHaveTextContent('ao vivo');
  });

  it('mostra as saídas seguintes das mesmas linhas', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(
      planned([
        {
          ...itineraryExample,
          alsoDepartsAt: ['2026-11-12T08:06:00-03:00', '2026-11-12T08:12:00-03:00'],
        },
      ]),
    );
    renderHarness(tripRequestExample);
    const option = await screen.findByRole('button', { name: /Das 08:00/ });
    expect(within(option).getByTestId('also-departs')).toHaveTextContent('Também às 08:06, 08:12');
  });

  it('trocar de itinerário redesenha o mapa com os trechos escolhidos', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([itineraryExample, directBus]));
    renderHarness(tripRequestExample);

    const second = await screen.findByRole('button', { name: /Das 08:10 às 09:20/ });
    expect(second).toHaveTextContent('Sem baldeação');
    fireEvent.click(second);

    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(lastLegs().features.map((f) => f.properties.mode)).toEqual(['bus']);
  });

  it('mostra estado vazio e de erro com "Tentar de novo"', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([]));
    const { unmount } = renderHarness(tripRequestExample);
    expect(
      await screen.findByText('Nenhuma rota de transporte para esse trajeto agora.'),
    ).toBeInTheDocument();
    expect(mapMock.sources).toHaveLength(0);
    unmount();

    spy.mockRejectedValue(
      new Error('O planejador está com problemas. Tente de novo em instantes.'),
    );
    renderHarness(tripRequestExample);
    expect(await screen.findByRole('alert')).toHaveTextContent('O planejador está com problemas');
    spy.mockResolvedValue(planned([itineraryExample]));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('button', { name: /Das 08:00/ })).toBeInTheDocument();
  });

  it('mostra os avisos de data fora da validade e de horário que já passou, sem botão de editar', () => {
    render(
      <ItineraryList
        status="success"
        itineraries={[itineraryExample]}
        selectedIndex={0}
        onSelect={() => {}}
        now={NOW}
        notices={['time_in_past_moved', 'date_outside_service']}
        onEditField={() => {}}
      />,
    );
    const avisos = screen.getByRole('list', { name: 'Avisos' });
    expect(avisos).toHaveTextContent('Esse horário já passou; mostramos as opções de amanhã.');
    expect(avisos).toHaveTextContent('Não há horários da SPTrans para essa data.');
    expect(within(avisos).queryByRole('button')).not.toBeInTheDocument();
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

describe('linha do tempo e camadas do itinerário', () => {
  it('descreve cada trecho, a baldeação e a chegada', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([itineraryExample]));
    renderHarness(tripRequestExample);
    const timeline = await screen.findByRole('list', { name: 'Trechos da viagem' });

    expect(
      within(timeline).getByText('Caminhe 350 m (5 min) até Av. Giovanni Gronchi'),
    ).toBeInTheDocument();
    expect(within(timeline).getByText('sentido Rio Pequeno')).toBeInTheDocument();
    expect(within(timeline).getByText('Embarque em Av. Giovanni Gronchi')).toBeInTheDocument();
    expect(within(timeline).getByText(/9 paradas · 18 min/)).toBeInTheDocument();
    expect(within(timeline).getByText(/Desça em Estação Butantã/)).toBeInTheDocument();
    expect(within(timeline).getByText('ao vivo')).toBeInTheDocument();
    expect(within(timeline).getByText('horário previsto')).toBeInTheDocument();
    expect(within(timeline).getByText('Baldeação · 6 min')).toBeInTheDocument();
    expect(within(timeline).getByText('Chegada em Terminal Rodoviário Tietê')).toBeInTheDocument();
  });

  it('troca "Destino" do OTP por "o destino" no texto', async () => {
    const lastWalk = {
      ...itineraryExample.legs[3]!,
      to: { ...itineraryExample.legs[3]!.to, name: 'Destino' },
    };
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(
      planned([{ ...itineraryExample, legs: [...itineraryExample.legs.slice(0, 3), lastWalk] }]),
    );
    renderHarness(tripRequestExample);
    expect(await screen.findByText('Caminhe 300 m (3 min) até o destino')).toBeInTheDocument();
  });

  it('desenha os trechos, enquadra com a folga do painel e destaca o trecho tocado', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([itineraryExample]));
    renderHarness(tripRequestExample);
    await screen.findByRole('list', { name: 'Trechos da viagem' });

    const data = lastLegs();
    expect(mapMock.sources.at(-1)?.id).toBe('itinerary');
    expect(data.features.map((f) => f.properties.mode)).toEqual(['walk', 'bus', 'subway', 'walk']);
    expect(data.features.map((f) => f.properties.color)).toEqual([
      WALK_COLOR,
      '#509E2F',
      '#FFD700',
      WALK_COLOR,
    ]);
    const layers = mapMock.layers.filter((l) => /^itinerary-(transit|walk)/.test(l.id)).slice(-3);
    expect(layers.map((l) => l.id)).toEqual([
      'itinerary-transit-casing',
      'itinerary-transit',
      'itinerary-walk',
    ]);
    expect(layers[1]?.paint['line-opacity']).toBe(1);
    expect(layers[2]?.paint['line-dasharray']).toBeDefined();
    expect(mapMock.fitBounds).toHaveBeenLastCalledWith(
      [
        [-46.7225, -23.6012],
        [-46.6249, -23.5163],
      ],
      expect.objectContaining({ padding: PADDING }),
    );

    const busLeg = screen.getByRole('button', { name: /sentido Rio Pequeno/ });
    fireEvent.click(busLeg);
    expect(busLeg).toHaveAttribute('aria-pressed', 'true');
    const focused = mapMock.layers.filter((l) => /^itinerary-(transit|walk)/.test(l.id)).slice(-3);
    expect(focused[1]?.paint['line-opacity']).toEqual([
      'case',
      ['==', ['get', 'legIndex'], 1],
      1,
      0.35,
    ]);
    expect(mapMock.fitBounds).toHaveBeenLastCalledWith(
      [
        [-46.7225, -23.6012],
        [-46.7081, -23.5719],
      ],
      expect.anything(),
    );

    fireEvent.click(busLeg);
    expect(
      mapMock.layers.findLast((l) => l.id === 'itinerary-transit')?.paint['line-opacity'],
    ).toBe(1);
  });
});
