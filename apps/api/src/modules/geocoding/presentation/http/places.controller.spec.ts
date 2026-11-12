import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PATHS, ApiErrorBodySchema, SearchPlacesResponseSchema } from '@baldeacao/types';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  InMemoryGeocodeCache,
  fakeNominatimFetch,
  readNominatimFixture,
} from '../../../../../test/support/geocoding-in-memory';
import { InMemoryStopRepository } from '../../../../../test/support/transit-in-memory';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
import { StopRepository } from '../../../transit/domain/ports/stop-repository.port';
import { SearchPlacesUseCase } from '../../application/use-cases/search-places.use-case';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { NominatimClient } from '../../infrastructure/adapters/nominatim.client';
import { NominatimGeocoderAdapter } from '../../infrastructure/adapters/nominatim-geocoder.adapter';
import { PlacesController } from './places.controller';

const MORUMBIS = readNominatimFixture('search-morumbis.json');

describe('HTTP do geocoding (contrato v2)', () => {
  let app: INestApplication<App>;
  let fetchFn: ReturnType<typeof fakeNominatimFetch>;

  beforeAll(async () => {
    fetchFn = fakeNominatimFetch(MORUMBIS);
    // "falha" responde 503 do Nominatim; o resto, a fixture.
    const fetchWithFailure: typeof fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes('q=falha')) return Promise.resolve(new Response('erro', { status: 503 }));
      return fetchFn(input, init);
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [PlacesController],
      providers: [
        SearchPlacesUseCase,
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

  it('Nominatim fora do ar vira 503 com ApiErrorBody', async () => {
    const res = await request(app.getHttpServer())
      .get(API_PATHS.searchPlaces)
      .query({ q: 'falha', mode: 'full' })
      .expect(503);
    expect(ApiErrorBodySchema.parse(res.body)).toEqual({
      code: 'SOURCE_UNAVAILABLE',
      message: expect.stringContaining('nominatim') as string,
    });
  });
});
