import { placeOriginExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { placesService } from '../services';
import { useMapPointPlace, useResolveMapPoint } from './use-map-point-place';

const point = { lat: -23.5501, lon: -46.6331 };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.restoreAllMocks());

describe('useMapPointPlace', () => {
  it('começa como "Ponto no mapa" e ganha o nome do lugar mais próximo na coordenada tocada', async () => {
    vi.spyOn(placesService, 'reverse').mockResolvedValue(placeOriginExample);
    const { result } = renderHook(() => useMapPointPlace(point), { wrapper });

    expect(result.current.place?.name).toBe('Ponto no mapa');
    await waitFor(() => expect(result.current.place?.name).toBe(placeOriginExample.name));
    expect(result.current.place).toMatchObject({
      kind: 'coordinates',
      location: point,
      address: placeOriginExample.address,
    });
  });

  it('sem ponto não consulta', () => {
    const spy = vi.spyOn(placesService, 'reverse');
    const { result } = renderHook(() => useMapPointPlace(null), { wrapper });
    expect(result.current.place).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useResolveMapPoint', () => {
  it('cai em "Ponto no mapa" quando a busca falha', async () => {
    vi.spyOn(placesService, 'reverse').mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useResolveMapPoint(), { wrapper });
    await expect(result.current(point)).resolves.toMatchObject({
      name: 'Ponto no mapa',
      location: point,
    });
  });
});
