import {
  fakeNominatimFetch,
  readNominatimFixture,
} from '../../../../../test/support/geocoding-in-memory';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { MinIntervalScheduler } from './min-interval-scheduler';
import { NOMINATIM_MIN_INTERVAL_MS, NominatimClient } from './nominatim.client';
import { NominatimGeocoderAdapter } from './nominatim-geocoder.adapter';

const MORUMBIS = readNominatimFixture('search-morumbis.json');

function adapterWith(fetchFn: typeof fetch, userAgent: string | null = 'baldeacao/test') {
  return new NominatimGeocoderAdapter(
    new NominatimClient({
      baseUrl: 'https://nominatim.test',
      userAgent: userAgent ?? undefined,
      fetch: fetchFn,
      retries: 0,
    }),
  );
}

describe('NominatimGeocoderAdapter', () => {
  afterEach(() => jest.useRealTimers());

  it('chama /search com jsonv2, Brasil, Grande SP, pt-BR e o User-Agent da config', async () => {
    const fetchFn = fakeNominatimFetch(MORUMBIS);
    const places = await adapterWith(fetchFn).search('estádio do morumbis', 8);

    expect(places).toHaveLength(4);
    const [{ url, headers }] = fetchFn.calls as [(typeof fetchFn.calls)[number]];
    expect(url.origin + url.pathname).toBe('https://nominatim.test/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'estádio do morumbis',
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'br',
      viewbox: '-47.21,-23.18,-45.69,-24.07',
      bounded: '1',
      'accept-language': 'pt-BR',
      limit: '8',
    });
    expect(headers.get('User-Agent')).toBe('baldeacao/test');
  });

  it('reverse chama /reverse com zoom 18 e mapeia o objeto; "Unable to geocode" vira null', async () => {
    const fetchFn = fakeNominatimFetch(readNominatimFixture('reverse-paulista.json'));
    const place = await adapterWith(fetchFn).reverse({ lat: -23.5633, lon: -46.6544 });
    expect(place).toMatchObject({
      id: 'osm:way:4335741',
      name: 'Avenida Paulista',
      kind: 'address',
    });
    const [{ url }] = fetchFn.calls as [(typeof fetchFn.calls)[number]];
    expect(url.pathname).toBe('/reverse');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '-23.5633',
      lon: '-46.6544',
      format: 'jsonv2',
      zoom: '18',
      addressdetails: '1',
      'accept-language': 'pt-BR',
    });
    const none = adapterWith(fakeNominatimFetch(readNominatimFixture('reverse-unable.json')));
    expect(await none.reverse({ lat: -10, lon: -40 })).toBeNull();
  });

  it('consulta só com CEP usa a busca estruturada (postalcode), sem q', async () => {
    const result = JSON.stringify([
      {
        place_id: 1,
        osm_type: 'way',
        osm_id: 10,
        lat: '-23.5614',
        lon: '-46.6559',
        category: 'place',
        type: 'postcode',
        addresstype: 'postcode',
        name: '',
        display_name: '01310-200, Bela Vista, São Paulo, Brasil',
        address: { postcode: '01310-200', suburb: 'Bela Vista', city: 'São Paulo' },
      },
      {
        place_id: 2,
        osm_type: 'node',
        osm_id: 11,
        lat: '-23.24',
        lon: '-46.41',
        category: 'place',
        type: 'postcode',
        addresstype: 'postcode',
        name: '',
        display_name: '12960-000, Nazaré Paulista, Brasil',
        address: { postcode: '12960-000', town: 'Nazaré Paulista' },
      },
    ]);
    const fetchFn = fakeNominatimFetch(result);
    const places = await adapterWith(fetchFn).search('cep:01310200', 8);
    // O CEP de outra cidade que o Nominatim devolveu fica de fora.
    expect(places.map((p) => p.id)).toEqual(['osm:way:10']);
    const [{ url }] = fetchFn.calls as [(typeof fetchFn.calls)[number]];
    expect(url.searchParams.get('postalcode')).toBe('01310-200');
    expect(url.searchParams.get('countrycodes')).toBe('br');
    expect(url.searchParams.get('viewbox')).toBe('-47.21,-23.18,-45.69,-24.07');
    expect(url.searchParams.has('q')).toBe(false);

    const empty = adapterWith(fakeNominatimFetch('[]'));
    expect(await empty.search('01310-200', 8)).toEqual([]);
  });

  it('corta no limite pedido', async () => {
    const places = await adapterWith(fakeNominatimFetch(MORUMBIS)).search('morumbis', 2);
    expect(places.map((p) => p.id)).toEqual(['osm:way:23935207', 'osm:node:4517265781']);
  });

  it('respeita 1 req/s mesmo com buscas simultâneas (relógio falso)', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-12T11:00:00Z') });
    const start = Date.now();
    const fetchFn = fakeNominatimFetch(MORUMBIS);
    const adapter = adapterWith(fetchFn);

    const searches = Promise.all([
      adapter.search('paulista', 8),
      adapter.search('sé', 8),
      adapter.search('tatuapé', 8),
    ]);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchFn.calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(999);
    expect(fetchFn.calls).toHaveLength(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetchFn.calls).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(1000);
    await searches;

    expect(fetchFn.calls.map((c) => c.atMs - start)).toEqual([0, 1000, 2000]);
    expect(fetchFn.calls.map((c) => c.url.searchParams.get('q'))).toEqual([
      'paulista',
      'sé',
      'tatuapé',
    ]);
  });

  it('uma falha não trava a fila', async () => {
    jest.useFakeTimers();
    let n = 0;
    const fetchFn: typeof fetch = () =>
      ++n === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(new Response('[]'));
    const adapter = adapterWith(fetchFn);
    const first = adapter.search('paulista', 8);
    const second = adapter.search('sé', 8);
    const firstResult = expect(first).rejects.toBeInstanceOf(SourceUnavailableError);
    await jest.advanceTimersByTimeAsync(1000);
    await firstResult;
    await expect(second).resolves.toEqual([]);
  });

  it('429 ou 5xx viram SourceUnavailableError', async () => {
    await expect(
      adapterWith(fakeNominatimFetch('{"error":"Too Many Requests"}', 429)).search('sé', 8),
    ).rejects.toBeInstanceOf(SourceUnavailableError);
    await expect(
      adapterWith(fakeNominatimFetch('erro', 503)).search('sé', 8),
    ).rejects.toBeInstanceOf(SourceUnavailableError);
  });

  it('sem NOMINATIM_USER_AGENT não chama o Nominatim', async () => {
    const fetchFn = fakeNominatimFetch(MORUMBIS);
    await expect(adapterWith(fetchFn, null).search('sé', 8)).rejects.toThrow(
      /NOMINATIM_USER_AGENT/,
    );
    expect(fetchFn.calls).toHaveLength(0);
  });
});

describe('NominatimClient com a fila cheia', () => {
  it('não chama o Nominatim e falha como fonte indisponível, com mensagem de muita procura', async () => {
    const fetchFn = fakeNominatimFetch(MORUMBIS);
    const full = new MinIntervalScheduler(
      NOMINATIM_MIN_INTERVAL_MS,
      () => 0,
      () => Promise.resolve(),
      0,
    );
    const adapter = new NominatimGeocoderAdapter(
      new NominatimClient({
        baseUrl: 'https://nominatim.test',
        userAgent: 'baldeacao/test',
        fetch: fetchFn,
        retries: 0,
        scheduler: full,
      }),
    );

    const error: unknown = await adapter.search('estádio do morumbis', 8).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceUnavailableError);
    expect((error as Error).message).toMatch(/muita procura/);
    expect(fetchFn.calls).toHaveLength(0);
  });
});
