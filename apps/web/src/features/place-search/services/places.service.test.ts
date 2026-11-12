import { placeOriginExample } from '@baldeacao/types/examples';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/shared/lib/api-client';
import { placesService } from './places.service';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('placesService.search', () => {
  it('chama /places/search com o texto codificado e devolve os lugares validados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ places: [placeOriginExample] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(placesService.search('Av. Paulista & 1000')).resolves.toEqual([
      placeOriginExample,
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3001/places/search?q=Av.+Paulista+%26+1000',
    );
  });

  it('rejeita resposta fora do contrato', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ places: [{ id: 1 }] })));
    await expect(placesService.search('Morumbis')).rejects.toBeInstanceOf(ApiError);
  });
});
