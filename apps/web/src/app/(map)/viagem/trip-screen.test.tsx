import type { Itinerary, PlanTripNotice } from '@baldeacao/types';
import { itineraryExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTripHref, parseTripSearchParams } from '@/features/trip-planner';
import { placesService } from '@/features/place-search/services';
import { tripPlannerService } from '@/features/trip-planner/services';
import { resetGeolocation } from '@/shared/hooks/use-geolocation';

import { TripScreen } from './trip-screen';

const planned = (itineraries: Itinerary[], notices: PlanTripNotice[] = []) => ({
  itineraries,
  notices,
});

vi.mock('@/shared/ui/map', () => ({
  MapLayers: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  CenterPicker: ({ onConfirm }: { onConfirm: (c: { lat: number; lon: number }) => void }) => (
    <button type="button" onClick={() => onConfirm({ lat: -23.55, lon: -46.63 })}>
      confirmar mira
    </button>
  ),
  UserLocationLayer: () => null,
}));

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  useMap: () => ({
    current: {
      fitBounds: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      hasImage: vi.fn(() => false),
      isStyleLoaded: vi.fn(() => false),
      getCanvas: () => ({ style: {} }),
    },
  }),
}));

function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, 'http://app.test').searchParams);
}

function renderScreen(href: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TripScreen initial={parseTripSearchParams(paramsOf(href))} />
    </QueryClientProvider>,
  );
}

const paulista = { lat: -23.5614, lon: -46.6559 };
const se = { lat: -23.5503, lon: -46.6339 };

beforeEach(() => resetGeolocation());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TripScreen', () => {
  it('lê origem e destino da URL e busca sozinho', async () => {
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([itineraryExample]));
    renderScreen(
      `/viagem?de=${paulista.lat},${paulista.lon}&deNome=Av.%20Paulista%201578&deTipo=stop&para=${se.lat},${se.lon}&paraNome=Ponto%20no%20mapa&paraTipo=coordinates`,
    );

    expect(screen.getByRole('combobox', { name: 'Origem' })).toHaveValue('Av. Paulista 1578');
    expect(screen.getByRole('combobox', { name: 'Destino' })).toHaveValue('Ponto no mapa');
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ from: paulista, to: se });
    expect(await screen.findByRole('list', { name: 'Trechos da viagem' })).toBeInTheDocument();
  });

  it('com "Minha localização" na origem pede o GPS e busca até o destino', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: paulista.lat, longitude: paulista.lon } }),
      },
    });
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(planned([]));
    const href = buildTripHref({
      from: 'current-location',
      to: {
        id: 'x',
        name: 'Praça da Sé',
        address: null,
        kind: 'stop',
        location: se,
      },
    });
    renderScreen(href);

    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Origem' })).toHaveValue('Minha localização'),
    );
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ from: paulista, to: se });
  });

  it('GPS negado avisa e põe o foco na origem, sem deixá-la vazia em silêncio', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_ok: unknown, fail: (e: unknown) => void) =>
          fail({ code: 1, PERMISSION_DENIED: 1 }),
      },
    });
    const spy = vi.spyOn(tripPlannerService, 'plan');
    renderScreen(buildTripHref({ from: 'current-location', focus: 'destination' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não conseguimos sua localização. Ative a permissão ou escolha a origem.',
    );
    expect(screen.getByRole('combobox', { name: 'Origem' })).toHaveFocus();
    expect(spy).not.toHaveBeenCalled();
  });

  it('sem pontas na URL não busca e orienta', () => {
    const spy = vi.spyOn(tripPlannerService, 'plan');
    renderScreen('/viagem?foco=destino');
    expect(screen.getByText('Escolha a origem e o destino para ver as rotas.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Destino' })).toHaveFocus();
    expect(spy).not.toHaveBeenCalled();
  });

  it('destino fora da área atendida explica e devolve o foco ao campo', async () => {
    vi.spyOn(tripPlannerService, 'plan').mockResolvedValue(
      planned([], ['destination_outside_service_area']),
    );
    renderScreen(
      `/viagem?de=${paulista.lat},${paulista.lon}&deNome=Paulista&deTipo=stop&para=-22.9,-43.2&paraNome=Rio&paraTipo=coordinates`,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O destino fica fora da área atendida pela SPTrans (nenhuma parada a até 1 km). Confira se escolheu o lugar certo.',
    );
    expect(
      screen.queryByText('Nenhuma rota de transporte para esse trajeto agora.'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar destino' }));
    expect(screen.getByRole('combobox', { name: 'Destino' })).toHaveFocus();
  });

  it('escolher no mapa dá nome ao ponto pela busca reversa', async () => {
    vi.spyOn(placesService, 'reverse').mockResolvedValue({
      id: 'osm:node:1',
      name: 'Praça da Sé',
      address: 'Sé, São Paulo',
      kind: 'poi',
      location: se,
    });
    renderScreen('/viagem?foco=destino');
    const destination = screen.getByRole('combobox', { name: 'Destino' });
    fireEvent.focus(destination);
    fireEvent.click(screen.getByRole('option', { name: /Escolher no mapa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'confirmar mira' }));

    expect(destination).toHaveValue('Ponto no mapa');
    await waitFor(() => expect(destination).toHaveValue('Praça da Sé'));
    expect(screen.getAllByText('Sé, São Paulo').length).toBeGreaterThan(0);
  });
});
