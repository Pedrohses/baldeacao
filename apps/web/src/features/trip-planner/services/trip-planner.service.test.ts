import { itineraryExample, tripRequestExample } from '@baldeacao/types/examples';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/shared/lib/api-client';
import { tripPlannerService } from './trip-planner.service';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tripPlannerService.plan', () => {
  it('faz POST em /trips/plan com o TripRequest e devolve os itinerários validados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ itineraries: [itineraryExample] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(tripPlannerService.plan(tripRequestExample)).resolves.toEqual({
      itineraries: [itineraryExample],
      notices: [],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:3001/trips/plan');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual(tripRequestExample);
  });

  it('repassa os avisos de área de atendimento', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ itineraries: [], notices: ['destination_outside_service_area'] }),
        ),
    );
    await expect(tripPlannerService.plan(tripRequestExample)).resolves.toEqual({
      itineraries: [],
      notices: ['destination_outside_service_area'],
    });
  });

  it('converte erro HTTP em ApiError com mensagem em português', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ message: 'otp down' }, { status: 503 })),
    );
    const error = await tripPlannerService.plan(tripRequestExample).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 503,
      message: 'O servidor está com problemas. Tente de novo em instantes.',
    });
  });

  it('converte falha de rede e resposta fora do contrato em ApiError status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(tripPlannerService.plan(tripRequestExample)).rejects.toMatchObject({ status: 0 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ itineraries: [{}] })));
    await expect(tripPlannerService.plan(tripRequestExample)).rejects.toMatchObject({
      status: 0,
      message: 'A resposta do servidor veio em um formato inesperado.',
    });
  });
});
