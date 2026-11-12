import { SourceUnavailableError } from '../../domain/errors/source-unavailable.error';
import { HttpClient, type HttpClientOptions } from './http-client';

const reply = (status: number, body = '', headers?: HeadersInit): Response =>
  new Response(body, { status, headers });

function make(fetchFn: jest.Mock, extra: Partial<HttpClientOptions> = {}) {
  const sleep = jest.fn().mockResolvedValue(undefined);
  const client = new HttpClient({
    source: 'teste',
    fetch: fetchFn,
    sleep,
    retries: 2,
    backoffMs: 100,
    ...extra,
  });
  return { client, sleep };
}

describe('HttpClient', () => {
  it('retorna corpo, json e todos os Set-Cookie', async () => {
    const headers = new Headers();
    headers.append('Set-Cookie', 'a=1; Path=/');
    headers.append('Set-Cookie', 'b=2; Path=/');
    const fetchFn = jest.fn().mockResolvedValue(reply(200, '{"x":1}', headers));
    const { client } = make(fetchFn);

    const res = await client.get('http://x/y');

    expect(res.json<{ x: number }>()).toEqual({ x: 1 });
    expect(res.setCookies).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('envia POST sem corpo com Content-Length 0 e User-Agent', async () => {
    const fetchFn = jest.fn().mockResolvedValue(reply(200, 'true'));
    const { client } = make(fetchFn, {
      userAgent: 'baldeacao/1.0',
      baseUrl: 'http://api.test/v2.1',
    });

    await client.post('Login/Autenticar?token=abc');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://api.test/v2.1/Login/Autenticar?token=abc');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({ 'Content-Length': '0', 'User-Agent': 'baldeacao/1.0' });
  });

  it('repete em 5xx com backoff exponencial e retorna o sucesso', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValueOnce(reply(503))
      .mockResolvedValueOnce(reply(500))
      .mockResolvedValueOnce(reply(200, 'ok'));
    const { client, sleep } = make(fetchFn);

    const res = await client.get('http://x');

    expect(res.text).toBe('ok');
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it('repete em erro de rede', async () => {
    const fetchFn = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(reply(200, 'ok'));
    const { client } = make(fetchFn);

    await expect(client.get('http://x')).resolves.toMatchObject({ status: 200 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('não repete em 4xx e devolve a resposta', async () => {
    const fetchFn = jest.fn().mockResolvedValue(reply(401));
    const { client } = make(fetchFn);

    const res = await client.get('http://x');

    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('lança SourceUnavailableError ao esgotar tentativas em 5xx', async () => {
    const fetchFn = jest.fn().mockResolvedValue(reply(502));
    const { client } = make(fetchFn);

    const error = await client.get('http://x').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SourceUnavailableError);
    expect((error as SourceUnavailableError).code).toBe('SOURCE_UNAVAILABLE');
    expect((error as SourceUnavailableError).source).toBe('teste');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('aborta por timeout e lança SourceUnavailableError', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const { client } = make(fetchFn, { timeoutMs: 10, retries: 1 });

    await expect(client.get('http://x')).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
