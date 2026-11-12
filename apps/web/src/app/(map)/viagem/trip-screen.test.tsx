import { itineraryExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTripHref, parseTripSearchParams } from '@/features/trip-planner';
import { tripPlannerService } from '@/features/trip-planner/services';
import { resetGeolocation } from '@/shared/hooks/use-geolocation';

import { TripScreen } from './trip-screen';

vi.mock('@/shared/ui/map', () => ({
  BaseMap: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  CenterPicker: () => null,
  UserLocationLayer: () => null,
}));

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  useMap: () => ({ current: { fitBounds: vi.fn(), on: vi.fn(), off: vi.fn() } }),
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
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([itineraryExample]);
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
    const spy = vi.spyOn(tripPlannerService, 'plan').mockResolvedValue([]);
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

  it('sem pontas na URL não busca e orienta', () => {
    const spy = vi.spyOn(tripPlannerService, 'plan');
    renderScreen('/viagem?foco=destino');
    expect(screen.getByText('Escolha a origem e o destino para ver as rotas.')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Destino' })).toHaveFocus();
    expect(spy).not.toHaveBeenCalled();
  });
});
