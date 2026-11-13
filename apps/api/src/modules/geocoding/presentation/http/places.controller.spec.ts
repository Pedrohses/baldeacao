import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  API_PATHS,
  ApiErrorBodySchema,
  ReversePlaceResponseSchema,
  SearchPlacesResponseSchema,
} from '@baldeacao/types';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  InMemoryGeocodeCache,
  InMemoryKnownPlaceRepository,
  fakeNominatimFetch,
  readNominatimFixture,
} from '../../../../../test/support/geocoding-in-memory';
import { InMemoryStopRepository } from '../../../../../test/support/transit-in-memory';
import { FindAccessStopsUseCase } from '../../../transit/application/use-cases/find-access-stops.use-case';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
import { StopRepository } from '../../../transit/domain/ports/stop-repository.port';
import { ReversePlaceUseCase } from '../../application/use-cases/reverse-place.use-case';
import { SearchPlacesUseCase } from '../../application/use-cases/search-places.use-case';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import { NominatimClient } from '../../infrastructure/adapters/nominatim.client';
import { NominatimGeocoderAdapter } from '../../infrastructure/adapters/nominatim-geocoder.adapter';
import { PlacesController } from './places.controller';

const MORUMBIS = readNominatimFixture('search-morumbis.json');
const REVERSE_PAULISTA = readNominatimFixture('reverse-paulista.json');
const REVERSE_UNABLE = readNominatimFixture('reverse-unable.json');

describe('HTTP do geocoding (contrato v2)', () => {
  let app: INestApplication<App>;
  let fetchFn: ReturnType<typeof fakeNominatimFetch>;

  beforeAll(async () => {
    fetchFn = fakeNominatimFetch(MORUMBIS);
    // "falha" responde 503 do Nominatim; o resto, a fixture.
    const fetchWithFailure: typeof fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes('q=falha')) return Promise.resolve(new Response('erro', { status: 503 }));
      if (url.includes('/reverse?')) {
        const body = url.includes('lat=-23.5633') ? REVERSE_PAULISTA : REVERSE_UNABLE;
        return fakeNominatimFetch(body)(input, init).then((res) => {
          fetchFn.calls.push({ url: new URL(url), headers: new Headers(), atMs: Date.now() });
          return res;
        });
      }
      return fetchFn(input, init);
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [
        SearchPlacesUseCase,
        ReversePlaceUseCase,
        FindAccessStopsUseCase,
        SearchStopsByNameUseCase,
        { provide: StopRepository, useValue: new InMemoryStopRepository() },
        {
          provide: NominatimClient,
          useValue: new NominatimClient({
            baseUrl: 'https://nominatim.test',
            userAgent: 'baldeacao/test',
            fetch: fetchWithFailure,
            retries: 0,
          }),
        },
        { provide: Geocoder, useClass: NominatimGeocoderAdapter },
        { provide: GeocodeCache, useValue: new InMemoryGeocodeCache() },
        { provide: KnownPlaceRepository, useValue: new InMemoryKnownPlaceRepository() },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app?.close());

  it('GET /places/search?q= devolve SearchPlacesResponse e usa o cache na repetição', async () => {
    const first = await request(app.getHttpServer())
      .get(API_PATHS.searchPlaces)
      .query({ q: 'Estádio do Morumbis', mode: 'full' })
      .expect(200);
    const body = SearchPlacesResponseSchema.parse(first.body);
    expect(body.places[0]).toEqual({
      id: 'osm:way:23935207',
      name: 'Estádio do Morumbis',
      address: 'Praça Roberto Gomes Pedrosa, 1, Morumbi, São Paulo',
      kind: 'poi',
      location: { lat: -23.6001163, lon: -46.720235 },
    });

    await request(app.getHttpServer())
      .get(API_PATHS.searchPlaces)
      .query({ q: 'estádio do morumbis', mode: 'full' })
      .expect(200);
    expect(fetchFn.calls).toHaveLength(1);
  });

  it('q curto ou ausente vira 400 com ApiErrorBody', async () => {
    for (const query of [{ q: 's' }, {}]) {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.searchPlaces)
        .query(query)
        .expect(400);
      expect(ApiErrorBodySchema.parse(res.body).code).toBe('INVALID_QUERY');
    }
  });

  it('mode inválido tem mensagem própria', async () => {
    const res = await request(app.getHttpServer())
      .get(API_PATHS.searchPlaces)
      .query({ q: 'paulista', mode: 'tudo' })
      .expect(400);
    expect(ApiErrorBodySchema.parse(res.body)).toEqual({
      code: 'INVALID_QUERY',
      message: 'Parâmetro mode inválido: use "quick" ou "full".',
    });
  });

  it('Nominatim fora do ar vira 503 com ApiErrorBody', async () => {
    const res = await request(app.getHttpServer())
      .get(API_PATHS.searchPlaces)
      .query({ q: 'falha', mode: 'full' })
      .expect(503);
    expect(ApiErrorBodySchema.parse(res.body)).toEqual({
      code: 'SOURCE_UNAVAILABLE',
      message:
        'A busca de endereços está indisponível no momento. Tente novamente em instantes ou informe outro lugar.',
    });
  });

  describe('GET /places/reverse', () => {
    it('parada local a até 60 m responde sem chamar o Nominatim', async () => {
      const before = fetchFn.calls.length;
      const res = await request(app.getHttpServer())
        .get(API_PATHS.reversePlace)
        .query({ lat: -23.5616, lon: -46.6559 })
        .expect(200);
      expect(ReversePlaceResponseSchema.parse(res.body).place).toMatchObject({
        id: 'stop:4301848',
        kind: 'stop',
      });
      expect(fetchFn.calls.length).toBe(before);
    });

    it('longe de lugar local usa o Nominatim e o cache na repetição', async () => {
      const before = fetchFn.calls.length;
      for (const lon of [-46.65441, -46.654412]) {
        const res = await request(app.getHttpServer())
          .get(API_PATHS.reversePlace)
          .query({ lat: -23.56329, lon })
          .expect(200);
        expect(ReversePlaceResponseSchema.parse(res.body).place).toEqual({
          id: 'osm:way:4335741',
          name: 'Avenida Paulista',
          address: 'Avenida Paulista, Bela Vista, São Paulo',
          kind: 'address',
          location: { lat: -23.5632871, lon: -46.654413 },
        });
      }
      expect(fetchFn.calls.length).toBe(before + 1);
    });

    it('sem lugar devolve { place: null }; coordenada inválida vira 400', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.reversePlace)
        .query({ lat: -10, lon: -40 })
        .expect(200);
      expect(res.body).toEqual({ place: null });
      const bad = await request(app.getHttpServer())
        .get(API_PATHS.reversePlace)
        .query({ lat: 100, lon: 0 })
        .expect(400);
      expect(ApiErrorBodySchema.parse(bad.body).code).toBe('INVALID_QUERY');
    });
  });
});
