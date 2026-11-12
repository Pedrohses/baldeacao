import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { OlhoVivoClient } from '../../../../shared/infrastructure/olho-vivo/olho-vivo.client';
import { OlhoVivoArrivalsAdapter } from './olho-vivo-arrivals.adapter';

const FIXTURES = join(__dirname, '../../../../../test/fixtures/olho-vivo');
const fixture = (name: string) => readFileSync(join(FIXTURES, `${name}.json`), 'utf8');

type Handler = (url: string) => Response;

function setup(handler: Handler, { token }: { token?: string } = { token: 'fake-token' }) {
  const urls: string[] = [];
  const fakeFetch: typeof fetch = (input) => {
    const url = input instanceof Request ? input.url : input.toString();
    urls.push(url);
    if (url.includes('Login/Autenticar')) {
      return Promise.resolve(
        new Response(fixture('login-ok'), {
          status: 200,
          headers: { 'Set-Cookie': 'apiCredentials=abc; path=/' },
        }),
      );
    }
    return Promise.resolve(handler(url));
  };
  const client = new OlhoVivoClient({
    token,
    userAgent: 'baldeacao/test',
    fetch: fakeFetch,
    retries: 1,
    sleep: () => Promise.resolve(),
  });
  return { adapter: new OlhoVivoArrivalsAdapter(client), urls };
}

describe('OlhoVivoArrivalsAdapter (fixtures, sem rede)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date('2026-11-12T15:34:30Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('consulta Previsao/Parada pelo código da parada e mapeia a resposta', async () => {
    const { adapter, urls } = setup(() => new Response(fixture('previsao-parada')));

    const arrivals = await adapter.forStop('4301848');

    expect(urls.at(-1)).toContain('Previsao/Parada?codigoParada=4301848');
    expect(arrivals.map((a) => [a.routeId, a.directionId, a.vehicleId, a.expectedAt])).toEqual([
      ['875A-10', 0, '11433', '2026-11-12T12:36:00-03:00'],
      ['875A-10', 0, '11502', '2026-11-12T12:44:00-03:00'],
    ]);
  });

  it('não chama a fonte para id que não é código da Olho Vivo', async () => {
    const { adapter, urls } = setup(() => new Response(fixture('previsao-parada')));
    await expect(adapter.forStop('abc')).resolves.toEqual([]);
    expect(urls).toEqual([]);
  });

  it('5xx esgotado vira SourceUnavailableError', async () => {
    const { adapter } = setup(() => new Response('erro', { status: 503 }));
    await expect(adapter.forStop('4301848')).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it('resposta fora do formato vira SourceUnavailableError', async () => {
    const { adapter } = setup(() => new Response(JSON.stringify({ hr: 'x' })));
    await expect(adapter.forStop('4301848')).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it('token ausente vira SourceUnavailableError', async () => {
    const { adapter } = setup(() => new Response(fixture('previsao-parada')), {});
    await expect(adapter.forStop('4301848')).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});
