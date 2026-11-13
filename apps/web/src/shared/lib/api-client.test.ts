import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ApiError, createApiClient } from './api-client';

const schema = z.object({ status: z.string() });

function client(response: () => Response) {
  const fetchFn = vi.fn<typeof fetch>(async () => response());
  return { api: createApiClient({ baseUrl: 'http://api.test/', fetchFn }), fetchFn };
}

describe('api-client', () => {
  it('devolve o corpo validado e monta a URL com a base', async () => {
    const { api, fetchFn } = client(() => Response.json({ status: 'ok' }));
    await expect(api.get('/health', schema)).resolves.toEqual({ status: 'ok' });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://api.test/health');
  });

  it('lança ApiError quando a resposta foge do schema', async () => {
    const { api } = client(() => Response.json({ status: 1 }));
    await expect(api.get('/health', schema)).rejects.toMatchObject({
      name: 'ApiError',
      message: 'A resposta do servidor veio em um formato inesperado.',
    });
  });

  it('lança ApiError com status e mensagem em português no 500', async () => {
    const { api } = client(() => Response.json({ message: 'boom' }, { status: 500 }));
    const error = await api.get('/health', schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).message).toContain('servidor');
    expect((error as ApiError).payload).toEqual({ message: 'boom' });
  });

  it('usa a mensagem do corpo { code, message } quando vem em português', async () => {
    const pt = client(() =>
      Response.json(
        { code: 'TRIP_INVALID', message: 'Origem e destino precisam ser diferentes.' },
        { status: 400 },
      ),
    );
    await expect(pt.api.get('/x', schema)).rejects.toMatchObject({
      status: 400,
      message: 'Origem e destino precisam ser diferentes.',
    });

    const en = client(() =>
      Response.json({ code: 'BAD_REQUEST', message: 'q must be longer' }, { status: 400 }),
    );
    await expect(en.api.get('/x', schema)).rejects.toMatchObject({
      message: 'Não foi possível concluir o pedido com esses dados.',
    });
  });

  it('converte falha de rede em ApiError', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('failed'));
    const api = createApiClient({ baseUrl: 'http://api.test', fetchFn });
    await expect(api.get('/x', schema)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('cleanApiMessage', () => {
  it('tira o prefixo técnico e a pontuação dupla', async () => {
    const { cleanApiMessage } = await import('./api-client');
    expect(cleanApiMessage('Pedido de viagem inválido (corpo: from.lat: obrigatório.).')).toBe(
      'Pedido de viagem inválido (from.lat: obrigatório).',
    );
  });
});
