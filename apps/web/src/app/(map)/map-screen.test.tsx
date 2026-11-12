import type { Coordinates, NearbyStop } from '@baldeacao/types';
import { stopExample, vehicleSnapshotExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initialMapState, useMapStore } from '@/features/live-map';
import { vehiclePositionsService } from '@/features/live-map/services';
import { addRecentPlace } from '@/features/place-search';
import { placesService } from '@/features/place-search/services';
import { stopsService } from '@/features/stops/services';

import { MapScreen } from './map-screen';

vi.mock('@/shared/lib/realtime-client', () => ({ subscribePositions: () => () => undefined }));

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  useMap: () => ({
    current: { on: vi.fn(), off: vi.fn(), getCanvas: () => ({ style: {} }), fitBounds: vi.fn() },
  }),
}));

// Mapa sem WebGL: o toque longo vira um botão de teste e o alfinete mostra só o cartão.
vi.mock('@/shared/ui/map', () => ({
  BaseMap: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  MAP_COLORS: { brand: '#C7361F' },
  useMapColors: () => ({
    brand: '#C7361F',
    brandRgb: '199, 54, 31',
    text: '#000',
    surface: '#fff',
  }),
  MapFlyTo: () => null,
  LocateButton: () => <button type="button">Minha localização</button>,
  UserLocationLayer: () => null,
  MapLongPress: ({ onLongPress }: { onLongPress: (c: Coordinates) => void }) => (
    <button type="button" onClick={() => onLongPress({ lat: -23.55, lon: -46.63 })}>
      simular toque longo
    </button>
  ),
  DroppedPin: ({ title, children }: { title: string; children: ReactNode }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

const nearby: NearbyStop = { ...stopExample, distanceM: 120 };

function query(href: string | null) {
  return Object.fromEntries(new URL(href ?? '', 'http://app.test').searchParams);
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useMapStore.setState(initialMapState);
  localStorage.clear();
  vi.spyOn(vehiclePositionsService, 'getSnapshot').mockResolvedValue(vehicleSnapshotExample);
  vi.spyOn(stopsService, 'getNearby').mockResolvedValue({ stops: [nearby] });
  vi.spyOn(stopsService, 'getArrivals').mockResolvedValue({ stopId: stopExample.id, arrivals: [] });
  vi.spyOn(placesService, 'reverse').mockResolvedValue(null);
});

afterEach(() => vi.restoreAllMocks());

describe('MapScreen', () => {
  it('"Para onde?" abre o planejador com origem na localização e foco no destino', () => {
    renderScreen();
    const link = screen.getByRole('link', { name: 'Para onde?' });
    expect(query(link.getAttribute('href'))).toEqual({ de: 'minha-localizacao', foco: 'destino' });
  });

  it('mostra até 3 destinos recentes como atalhos', () => {
    for (const name of ['A', 'B', 'C', 'D']) {
      addRecentPlace({
        ...nearby,
        id: `stop:${name}`,
        name: `Parada ${name}`,
        address: null,
        kind: 'stop',
      });
    }
    renderScreen();
    const chips = within(screen.getByRole('list', { name: 'Destinos recentes' })).getAllByRole(
      'link',
    );
    expect(chips.map((c) => c.textContent)).toEqual(['Parada D', 'Parada C', 'Parada B']);
    expect(query(chips[0]!.getAttribute('href'))).toMatchObject({
      paraNome: 'Parada D',
      paraTipo: 'stop',
    });
  });

  it('toque longo solta um alfinete com "Ir para cá" e "Sair daqui"', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'simular toque longo' }));

    const card = screen.getByRole('region', { name: 'Ponto no mapa' });
    expect(
      query(within(card).getByRole('link', { name: 'Ir para cá' }).getAttribute('href')),
    ).toEqual({
      de: 'minha-localizacao',
      para: '-23.550000,-46.630000',
      paraNome: 'Ponto no mapa',
      paraTipo: 'coordinates',
    });
    expect(
      query(within(card).getByRole('link', { name: 'Sair daqui' }).getAttribute('href')),
    ).toEqual({
      de: '-23.550000,-46.630000',
      deNome: 'Ponto no mapa',
      deTipo: 'coordinates',
      foco: 'destino',
    });
  });

  it('o alfinete ganha o nome do lugar mais próximo pela busca reversa', async () => {
    vi.spyOn(placesService, 'reverse').mockResolvedValue({
      id: 'osm:node:1',
      name: 'Praça da Sé',
      address: 'Sé, São Paulo',
      kind: 'poi',
      location: { lat: -23.5502, lon: -46.6331 },
    });
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: 'simular toque longo' }));

    const card = await screen.findByRole('region', { name: 'Praça da Sé' });
    expect(
      query(within(card).getByRole('link', { name: 'Ir para cá' }).getAttribute('href')),
    ).toMatchObject({ para: '-23.550000,-46.630000', paraNome: 'Praça da Sé' });
  });

  it('a parada escolhida na lista abre no painel com as ações do planejador', async () => {
    renderScreen();
    expect(
      screen.getByRole('heading', { name: 'Paradas perto do centro do mapa' }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Av. Paulista 1578/ }));

    expect(
      screen.getByRole('heading', { level: 2, name: 'Av. Paulista 1578' }),
    ).toBeInTheDocument();
    const goHere = screen.getByRole('link', { name: 'Ir para cá' });
    expect(query(goHere.getAttribute('href'))).toMatchObject({
      de: 'minha-localizacao',
      paraNome: 'Av. Paulista 1578',
      paraTipo: 'stop',
    });
    expect(useMapStore.getState().selection).toEqual({ kind: 'stop', stopId: stopExample.id });

    fireEvent.click(screen.getByRole('button', { name: 'Fechar painel da parada' }));
    expect(screen.getByRole('link', { name: 'Para onde?' })).toBeInTheDocument();
    expect(useMapStore.getState().selection).toBeNull();
  });
});
