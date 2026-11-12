import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OlhoVivoAuthError } from '../../domain/errors/olho-vivo-auth.error';
import { OlhoVivoClient } from './olho-vivo.client';

const fixture = (name: string): string =>
  readFileSync(resolve(__dirname, '../../../../test/fixtures/olho-vivo', `${name}.json`), 'utf8');

const COOKIE = 'apiCredentials=abc123; path=/; HttpOnly';

interface Call {
  url: string;
  method: string;
  cookie: string | undefined;
}

function setup(handler: (call: Call) => Response) {
  const calls: Call[] = [];
  const fakeFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    const call: Call = {
      url: input instanceof Request ? input.url : input.toString(),
      method: init?.method ?? 'GET',
      cookie: headers.get('cookie') ?? undefined,
    };
    calls.push(call);
    return Promise.resolve(handler(call));
  };
  const client = new OlhoVivoClient({
    token: 'fake-token',
    userAgent: 'baldeacao/test',
    fetch: fakeFetch,
    sleep: () => Promise.resolve(),
  });
  return { client, calls };
}

const loginOk = (): Response =>
  new Response(fixture('login-ok'), { status: 200, headers: { 'Set-Cookie': COOKIE } });
const json = (name: string, status = 200): Response => new Response(fixture(name), { status });
const isLogin = (call: Call): boolean => call.url.includes('Login/Autenticar');

describe('OlhoVivoClient', () => {
  it('logs in lazily, stores the cookie and sends it on calls', async () => {
    const { client, calls } = setup((call) => (isLogin(call) ? loginOk() : json('posicao')));

    const positions = await client.getPositions();

    expect(positions.l[0]?.vs).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST' });
    expect(calls[0]?.url).toContain('Login/Autenticar?token=fake-token');
    expect(calls[1]?.cookie).toBe('apiCredentials=abc123');

    await client.getPositions();
    expect(calls.filter(isLogin)).toHaveLength(1);
  });

  it('throws OlhoVivoAuthError when the token is refused', async () => {
    const { client } = setup(() => json('login-recusado'));

    await expect(client.getPositions()).rejects.toBeInstanceOf(OlhoVivoAuthError);
  });

  it('logs in again once and repeats the call on 401', async () => {
    let positionCalls = 0;
    const { client, calls } = setup((call) => {
      if (isLogin(call)) return loginOk();
      positionCalls += 1;
      return positionCalls === 1 ? json('unauthorized-401', 401) : json('posicao');
    });

    const positions = await client.getPositions();

    expect(positions.hr).toBe('12:34');
    expect(calls.filter(isLogin)).toHaveLength(2);
    expect(calls).toHaveLength(4);
  });

  it('deduplicates concurrent logins', async () => {
    const { client, calls } = setup((call) => (isLogin(call) ? loginOk() : json('posicao')));

    await Promise.all([client.getPositions(), client.getPositions()]);

    expect(calls.filter(isLogin)).toHaveLength(1);
  });

  it('appends query params', async () => {
    const { client, calls } = setup((call) => (isLogin(call) ? loginOk() : json('posicao')));

    await client.get('Posicao/Linha', { codigoLinha: 1273 });

    expect(calls[1]?.url).toContain('Posicao/Linha?codigoLinha=1273');
  });
});
