import type { Place } from '@baldeacao/types';
import { placeDestinationExample, placeOriginExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { placesService } from '../services';
import { PlaceAutocomplete } from './place-autocomplete';

const onChange = vi.fn<(place: Place | null) => void>();

function Harness({ initial = null }: { initial?: Place | null }) {
  const [value, setValue] = useState<Place | null>(initial);
  return (
    <PlaceAutocomplete
      label="Origem"
      value={value}
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

beforeEach(() => {
  vi.useFakeTimers();
  onChange.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PlaceAutocomplete', () => {
  it('espera 300 ms sem digitação antes de buscar, uma vez só', async () => {
    const spy = vi.spyOn(placesService, 'search').mockResolvedValue([placeOriginExample]);
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
    expect(spy.mock.calls[0]?.[0]).toBe('Morumbis');

    await advance(0);
    expect(screen.getByRole('option', { name: /Estádio do Morumbis/ })).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('não busca com menos de 2 caracteres e avisa o mínimo', async () => {
    const spy = vi.spyOn(placesService, 'search');
    const input = renderAutocomplete();

    type(input, 'M');
    await advance(500);
    expect(spy).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Digite pelo menos 2 caracteres.');
  });

  it('navega pelas sugestões com as setas e escolhe com Enter', async () => {
    vi.spyOn(placesService, 'search').mockResolvedValue([
      placeOriginExample,
      placeDestinationExample,
    ]);
    const input = renderAutocomplete();

    type(input, 'terminal');
    await advance(300);
    await advance(0);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const second = screen.getByRole('option', { name: /Terminal Rodoviário Tietê/ });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', second.id);

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // volta ao começo
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenLastCalledWith(placeDestinationExample);
    expect(input).toHaveValue('Terminal Rodoviário Tietê');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('Escape fecha a lista sem escolher', async () => {
    vi.spyOn(placesService, 'search').mockResolvedValue([placeOriginExample]);
    const input = renderAutocomplete();

    type(input, 'Morumbis');
    await advance(300);
    await advance(0);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('escolhe com clique', async () => {
    vi.spyOn(placesService, 'search').mockResolvedValue([placeOriginExample]);
    const input = renderAutocomplete();

    type(input, 'Morumbis');
    await advance(300);
    await advance(0);
    fireEvent.click(screen.getByRole('option', { name: /Estádio do Morumbis/ }));

    expect(onChange).toHaveBeenLastCalledWith(placeOriginExample);
  });

  it('mostra estado vazio', async () => {
    vi.spyOn(placesService, 'search').mockResolvedValue([]);
    const input = renderAutocomplete();

    type(input, 'xyzxyz');
    await advance(300);
    await advance(0);

    expect(screen.getByRole('status')).toHaveTextContent('Nenhum lugar encontrado.');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('mostra erro quando a busca falha', async () => {
    vi.spyOn(placesService, 'search').mockRejectedValue(new Error('falhou'));
    const input = renderAutocomplete();

    type(input, 'Morumbis');
    await advance(300);
    await advance(0);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível buscar lugares. Tente de novo.',
    );
  });

  it('editar o texto de um lugar escolhido limpa a escolha e não busca o nome escolhido', async () => {
    const spy = vi.spyOn(placesService, 'search').mockResolvedValue([]);
    const input = renderAutocomplete(placeOriginExample);
    expect(input).toHaveValue('Estádio do Morumbis');

    fireEvent.focus(input);
    await advance(500);
    expect(spy).not.toHaveBeenCalled();

    type(input, 'Estádio do Morumbi');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input).toHaveValue('Estádio do Morumbi');
    await advance(300);
    expect(spy).toHaveBeenCalledWith('Estádio do Morumbi', expect.anything());
  });
});
