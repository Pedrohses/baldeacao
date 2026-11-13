import type { Place, SearchPlacesMode } from '@baldeacao/types';
import { placeDestinationExample, placeOriginExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetGeolocation } from '@/shared/hooks/use-geolocation';

import { addRecentPlace, resetRecentPlacesCache } from '../hooks';
import { placesService } from '../services';
import { PlaceAutocomplete } from './place-autocomplete';

const onChange = vi.fn<(place: Place | null) => void>();
const onPickOnMap = vi.fn();

const augusta: Place = {
  id: 'osm:way:1',
  name: 'Rua Augusta, 1500',
  address: 'Consolação, São Paulo',
  kind: 'address',
  location: { lat: -23.556, lon: -46.659 },
};
const allianz: Place = {
  id: 'osm:way:4',
  name: 'Allianz Parque',
  address: 'Avenida Francisco Matarazzo, 1705, Água Branca, São Paulo',
  kind: 'poi',
  location: { lat: -23.5275, lon: -46.6783 },
};
const flores1: Place = { ...augusta, id: 'osm:way:2', name: 'Rua das Flores', address: 'Lapa' };
const flores2: Place = { ...augusta, id: 'osm:way:3', name: 'Rua das Flores', address: 'Penha' };

function Harness({ initial = null }: { initial?: Place | null }) {
  const [value, setValue] = useState<Place | null>(initial);
  return (
    <PlaceAutocomplete
      label="Origem"
      value={value}
      onPickOnMap={onPickOnMap}
      onChange={(place) => {
        onChange(place);
        setValue(place);
      }}
    />
  );
}

function renderAutocomplete(initial?: Place | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness initial={initial ?? null} />
    </QueryClientProvider>,
  );
  return screen.getByRole('combobox', { name: 'Origem' });
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

function type(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}

/** quick e full com respostas diferentes. */
function mockSearch(results: Partial<Record<SearchPlacesMode, Place[] | Error>>) {
  return vi.spyOn(placesService, 'search').mockImplementation(async (_q, mode) => {
    const result = results[mode] ?? [];
    if (result instanceof Error) throw result;
    return result;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  onChange.mockReset();
  onPickOnMap.mockReset();
  localStorage.clear();
  resetRecentPlacesCache();
  resetGeolocation();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PlaceAutocomplete: autocompletar', () => {
  it('espera 300 ms sem digitação e busca no modo quick, uma vez só', async () => {
    const spy = mockSearch({ quick: [placeOriginExample] });
    const input = renderAutocomplete();

    type(input, 'Mor');
    await advance(200);
    type(input, 'Morum');
    await advance(200);
    type(input, 'Morumbis');
    await advance(299);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Buscando lugares...');

    await advance(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.slice(0, 2)).toEqual(['Morumbis', 'quick']);

    await advance(0);
    const option = screen.getByRole('option', { name: /Estádio do Morumbis/ });
    expect(option).toBeInTheDocument();
    // Trecho digitado em negrito.
    expect(option.querySelector('strong')).toHaveTextContent('Morumbis');
    expect(screen.getByRole('option', { name: /Buscar endereço "Morumbis"/ })).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('não busca com menos de 2 caracteres e avisa o mínimo', async () => {
    const spy = mockSearch({});
    const input = renderAutocomplete();

    type(input, 'M');
    await advance(500);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Digite pelo menos 2 caracteres.');
  });

  it('navega pelas sugestões com as setas e escolhe com Enter', async () => {
    mockSearch({ quick: [placeOriginExample, placeDestinationExample] });
    const input = renderAutocomplete();

    type(input, 'terminal');
    await advance(300);
    await advance(0);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const second = screen.getByRole('option', { name: /Terminal Rodoviário Tietê/ });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', second.id);

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // "Buscar endereço"
    fireEvent.keyDown(input, { key: 'ArrowDown' }); // volta ao começo
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(placeDestinationExample);
    expect(input).toHaveValue('Terminal Rodoviário Tietê');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('Escape fecha a lista sem escolher', async () => {
    mockSearch({ quick: [placeOriginExample] });
    const input = renderAutocomplete();

    type(input, 'Morumbis');
    await advance(300);
    await advance(0);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('escolhe com clique e mostra o ícone do tipo com o endereço', async () => {
    mockSearch({ quick: [placeOriginExample] });
    const input = renderAutocomplete();

    type(input, 'Morumbis');
    await advance(300);
    await advance(0);
    fireEvent.click(screen.getByRole('option', { name: /Estádio do Morumbis/ }));

    expect(onChange).toHaveBeenLastCalledWith(placeOriginExample);
  });

  it('lugar escolhido mostra o endereço abaixo do nome e some ao editar', () => {
    const input = renderAutocomplete(augusta);
    expect(screen.getByTestId('place-subtitle')).toHaveTextContent('Consolação, São Paulo');
    expect(input).toHaveAccessibleDescription(/Consolação, São Paulo/);

    type(input, 'Rua Augusta');
    expect(screen.queryByTestId('place-subtitle')).not.toBeInTheDocument();
  });

  it('editar o texto de um lugar escolhido limpa a escolha e não busca o nome escolhido', async () => {
    const spy = mockSearch({});
    const input = renderAutocomplete(placeOriginExample);
    expect(input).toHaveValue('Estádio do Morumbis');

    fireEvent.focus(input);
    await advance(500);
    expect(spy).not.toHaveBeenCalled();

    type(input, 'Estádio do Morumbi');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input).toHaveValue('Estádio do Morumbi');
    await advance(300);
    expect(spy).toHaveBeenCalledWith('Estádio do Morumbi', 'quick', expect.anything());
  });
});

describe('PlaceAutocomplete: aceita o que foi digitado', () => {
  it('Enter usa a busca completa, não a 1ª sugestão rápida: "Allianz Parque" escolhe sozinho', async () => {
    const stop: Place = { ...augusta, id: 'stop:1', name: 'Parque Dom Pedro II', kind: 'stop' };
    const spy = mockSearch({ quick: [stop], full: [allianz, stop] });
    const input = renderAutocomplete();

    type(input, 'Allianz Parque');
    await advance(300);
    await advance(0);
    fireEvent.keyDown(input, { key: 'Enter' });
    await advance(0);

    expect(spy).toHaveBeenLastCalledWith('Allianz Parque', 'full', expect.anything());
    expect(onChange).toHaveBeenLastCalledWith(allianz);
  });

  it('"Mercadão" sem resultado forte abre a lista com o 1º destacado', async () => {
    const mercado: Place = { ...allianz, id: 'osm:way:9', name: 'Mercado Municipal Paulistano' };
    mockSearch({ quick: [], full: [mercado, allianz] });
    const input = renderAutocomplete();

    type(input, 'Mercadão');
    fireEvent.keyDown(input, { key: 'Enter' });
    await advance(0);

    expect(onChange).not.toHaveBeenCalled();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0]!.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith(mercado);
  });

  it('"Rua Vergueiro 3185" só escolhe sozinho se o número bate', async () => {
    const vergueiro: Place = {
      ...augusta,
      id: 'osm:node:5',
      name: 'Rua Vergueiro, 3185',
      address: 'Vila Mariana, São Paulo',
    };
    const semNumero: Place = { ...vergueiro, id: 'osm:way:6', name: 'Rua Vergueiro' };
    mockSearch({ full: [semNumero, vergueiro] });
    const input = renderAutocomplete();

    type(input, 'Rua Vergueiro 3185');
    fireEvent.blur(input);
    await advance(0);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('"Rua Vergueiro 3185" com o número no 1º resultado escolhe sozinho', async () => {
    const vergueiro: Place = {
      ...augusta,
      id: 'osm:node:5',
      name: 'Rua Vergueiro, 3185',
      address: 'Vila Mariana, São Paulo',
    };
    mockSearch({ full: [vergueiro, { ...vergueiro, id: 'osm:way:6', name: 'Rua Vergueiro' }] });
    const input = renderAutocomplete();

    type(input, 'Rua Vergueiro 3185');
    fireEvent.keyDown(input, { key: 'Enter' });
    await advance(0);
    expect(onChange).toHaveBeenLastCalledWith(vergueiro);
  });

  it('Enter sem sugestão faz a busca completa e escolhe o 1º resultado', async () => {
    const spy = mockSearch({ quick: [], full: [augusta] });
    const input = renderAutocomplete();

    type(input, 'Rua Augusta 1500');
    await advance(300);
    await advance(0);
    fireEvent.keyDown(input, { key: 'Enter' });
    await advance(0);

    expect(spy).toHaveBeenCalledWith('Rua Augusta 1500', 'full', expect.anything());
    expect(onChange).toHaveBeenLastCalledWith(augusta);
    expect(input).toHaveValue('Rua Augusta, 1500');
  });

  it('sair do campo antes das sugestões chegarem também resolve pela busca completa', async () => {
    const spy = mockSearch({ quick: [], full: [augusta] });
    const input = renderAutocomplete();

    type(input, 'Rua Augusta 1500');
    fireEvent.blur(input);
    await advance(0);

    expect(spy).toHaveBeenCalledWith('Rua Augusta 1500', 'full', expect.anything());
    expect(onChange).toHaveBeenLastCalledWith(augusta);
  });

  it('com homônimos abre a lista para a pessoa escolher', async () => {
    mockSearch({ quick: [], full: [flores1, flores2] });
    const input = renderAutocomplete();

    type(input, 'Rua das Flores');
    fireEvent.blur(input);
    await advance(0);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('2 resultados encontrados');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    fireEvent.click(options[1]!);
    expect(onChange).toHaveBeenLastCalledWith(flores2);
  });

  it('"Buscar endereço" chama a busca completa', async () => {
    const spy = mockSearch({ quick: [placeOriginExample], full: [augusta] });
    const input = renderAutocomplete();

    type(input, 'Augusta');
    await advance(300);
    await advance(0);
    fireEvent.click(screen.getByRole('option', { name: /Buscar endereço "Augusta"/ }));
    await advance(0);

    expect(spy).toHaveBeenLastCalledWith('Augusta', 'full', expect.anything());
    expect(onChange).toHaveBeenLastCalledWith(augusta);
  });

  it('mostra a mensagem de não encontrado com os atalhos', async () => {
    mockSearch({ quick: [], full: [] });
    const input = renderAutocomplete();

    type(input, 'xyzxyz');
    fireEvent.keyDown(input, { key: 'Enter' });
    await advance(0);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Não achamos "xyzxyz". Tente rua e número, por exemplo Rua Augusta, 1500, ou o nome de uma estação.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Escolher no mapa' }));
    expect(onPickOnMap).toHaveBeenCalledOnce();
  });

  it('erro de rede mostra "Sem conexão" e tenta de novo', async () => {
    const spy = mockSearch({ quick: [], full: new Error('offline') });
    const input = renderAutocomplete();

    type(input, 'Rua Augusta');
    fireEvent.keyDown(input, { key: 'Enter' });
    await advance(0);

    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com a busca. Tente de novo.');
    spy.mockImplementation(async (_q, mode) => (mode === 'full' ? [augusta] : []));
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await advance(0);
    expect(onChange).toHaveBeenLastCalledWith(augusta);
  });
});

describe('PlaceAutocomplete: atalhos', () => {
  it('com o campo vazio mostra Minha localização, Escolher no mapa e os recentes', () => {
    addRecentPlace(placeDestinationExample);
    const input = renderAutocomplete();
    fireEvent.focus(input);

    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Minha localização'),
      expect.stringContaining('Escolher no mapa'),
      expect.stringContaining('Terminal Rodoviário Tietê'),
    ]);
    expect(screen.getByText('Recentes')).toBeInTheDocument();

    fireEvent.click(options[1]!);
    expect(onPickOnMap).toHaveBeenCalledOnce();
  });

  it('escolher um lugar o guarda nos recentes', async () => {
    mockSearch({ quick: [placeOriginExample] });
    const input = renderAutocomplete();
    type(input, 'Morumbis');
    await advance(300);
    await advance(0);
    fireEvent.click(screen.getByRole('option', { name: /Estádio do Morumbis/ }));

    const stored = JSON.parse(localStorage.getItem('baldeacao:recent-places') ?? '[]');
    expect(stored).toEqual([placeOriginExample]);
  });

  it('Minha localização usa o GPS e vira um lugar do tipo coordenadas', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: (p: unknown) => void) =>
          ok({ coords: { latitude: -23.5, longitude: -46.6 } }),
      },
    });
    const input = renderAutocomplete();
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole('option', { name: /Minha localização/ }));
    await advance(0);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        name: 'Minha localização',
        kind: 'coordinates',
        location: { lat: -23.5, lon: -46.6 },
      }),
    );
  });
});
