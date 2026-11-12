import { routeExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { linesService } from '../services';
import { LineSearch } from './line-search';

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <LineSearch hrefFor={(line) => `/linhas/${line.id}`} />
    </QueryClientProvider>,
  );
  return screen.getByRole('searchbox', { name: 'Buscar linha' });
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('LineSearch', () => {
  it('espera a digitação parar, busca uma vez e lista as linhas com o selo na cor do GTFS', async () => {
    const spy = vi.spyOn(linesService, 'search').mockResolvedValue([routeExample]);
    const input = renderSearch();

    fireEvent.change(input, { target: { value: '87' } });
    fireEvent.change(input, { target: { value: '875' } });
    await advance(299);
    expect(spy).not.toHaveBeenCalled();
    await advance(1);
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('875', expect.anything());

    const link = screen.getByRole('link', { name: /875A-10/ });
    expect(link).toHaveAttribute('href', `/linhas/${routeExample.id}`);
    expect(link).toHaveTextContent(routeExample.longName);
    expect(screen.getByTestId('line-badge')).toHaveStyle({
      backgroundColor: `#${routeExample.color}`,
    });
  });

  it('avisa o mínimo de caracteres e quando não acha nada', async () => {
    vi.spyOn(linesService, 'search').mockResolvedValue([]);
    const input = renderSearch();

    fireEvent.change(input, { target: { value: '8' } });
    expect(screen.getByRole('status')).toHaveTextContent('Digite pelo menos 2 caracteres.');
    fireEvent.change(input, { target: { value: 'xyz' } });
    await advance(300);
    await advance(0);
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma linha encontrada para "xyz".');
  });

  it('erro de rede oferece "Tentar de novo"', async () => {
    const spy = vi.spyOn(linesService, 'search').mockRejectedValue(new Error('offline'));
    const input = renderSearch();
    fireEvent.change(input, { target: { value: '875' } });
    await advance(300);
    await advance(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Sem conexão com a busca.');

    spy.mockResolvedValue([routeExample]);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await advance(0);
    expect(screen.getByRole('link', { name: /875A-10/ })).toBeInTheDocument();
  });
});
