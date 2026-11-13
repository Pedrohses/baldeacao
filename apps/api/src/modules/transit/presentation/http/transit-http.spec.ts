import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  API_PATHS,
  ApiErrorBodySchema,
  LineDetailsResponseSchema,
  NearbyStopsResponseSchema,
  SearchLinesResponseSchema,
  StopArrivalsResponseSchema,
} from '@baldeacao/types';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  InMemoryRouteRepository,
  InMemoryStopRepository,
  stopLiberdade,
  stopPaulista,
} from '../../../../../test/support/transit-in-memory';
import { Stop } from '../../domain/entities/stop.entity';
import { OlhoVivoClient } from '../../../../shared/infrastructure/olho-vivo/olho-vivo.client';
import { FindNearbyStopsUseCase } from '../../application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from '../../application/use-cases/get-line-details.use-case';
import { GetStopArrivalsUseCase } from '../../application/use-cases/get-stop-arrivals.use-case';
import { SearchLinesUseCase } from '../../application/use-cases/search-lines.use-case';
import type { Arrival } from '../../domain/entities/arrival.entity';
import { ArrivalsCache } from '../../domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from '../../domain/ports/arrivals-provider.port';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import { LinesController } from './lines.controller';
import { OlhoVivoArrivalsAdapter } from '../../infrastructure/adapters/olho-vivo-arrivals.adapter';
import { StopsController } from './stops.controller';

const PREVISAO = readFileSync(
  join(__dirname, '../../../../../test/fixtures/olho-vivo/previsao-parada.json'),
  'utf8',
);

// Olho Vivo falsa: login ok, previsão da fixture para 4301848 e 503 para 4200953.
const fakeOlhoVivo: typeof fetch = (input) => {
  const url = input instanceof Request ? input.url : input.toString();
  if (url.includes('Login/Autenticar')) {
    return Promise.resolve(
      new Response('true', { headers: { 'Set-Cookie': 'apiCredentials=abc; path=/' } }),
    );
  }
  if (url.includes('codigoParada=4200953')) {
    return Promise.resolve(new Response('erro', { status: 503 }));
  }
  return Promise.resolve(new Response(PREVISAO));
};

class NoopArrivalsCache extends ArrivalsCache {
  get(): Promise<Arrival[] | null> {
    return Promise.resolve(null);
  }
  set(): Promise<void> {
    return Promise.resolve();
  }
}

describe('HTTP do transit (contrato v1)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LinesController, StopsController],
      providers: [
        SearchLinesUseCase,
        GetLineDetailsUseCase,
        FindNearbyStopsUseCase,
        GetStopArrivalsUseCase,
        {
          provide: ArrivalsProvider,
          useValue: new OlhoVivoArrivalsAdapter(
            new OlhoVivoClient({
              token: 'fake-token',
              userAgent: 'baldeacao/test',
              fetch: fakeOlhoVivo,
              retries: 0,
            }),
          ),
        },
        { provide: ArrivalsCache, useValue: new NoopArrivalsCache() },
        { provide: RouteRepository, useValue: new InMemoryRouteRepository() },
        {
          provide: StopRepository,
          // 4200953 existe no GTFS; a Olho Vivo falsa é que falha para ela.
          useValue: new InMemoryStopRepository([
            stopPaulista,
            stopLiberdade,
            new Stop({ ...stopLiberdade, id: '4200953', name: 'Parada que falha' }),
          ]),
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  describe(`GET ${API_PATHS.searchLines}`, () => {
    it('responde SearchLinesResponse', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.searchLines)
        .query({ q: '875' })
        .expect(200);
      const body = SearchLinesResponseSchema.parse(res.body);
      expect(body.lines.map((l) => l.id)).toEqual(['875A-10']);
    });

    it('responde 400 ApiErrorBody quando q falta ou é curto', async () => {
      for (const query of [{}, { q: 'a' }]) {
        const res = await request(app.getHttpServer())
          .get(API_PATHS.searchLines)
          .query(query)
          .expect(400);
        expect(ApiErrorBodySchema.parse(res.body).code).toBe('INVALID_QUERY');
      }
    });
  });

  describe('GET lineDetails', () => {
    it('responde LineDetailsResponse no caminho do contrato', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.lineDetails('875A-10'))
        .expect(200);
      const body = LineDetailsResponseSchema.parse(res.body);
      expect(body.line.id).toBe('875A-10');
      expect(body.shapes.map((s) => s.directionId)).toEqual([0]);
    });

    it('responde 404 ApiErrorBody para linha desconhecida', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.lineDetails('9999-10'))
        .expect(404);
      expect(ApiErrorBodySchema.parse(res.body)).toEqual({
        code: 'LINE_NOT_FOUND',
        message: 'Linha 9999-10 não encontrada.',
      });
    });
  });

  describe(`GET ${API_PATHS.nearbyStops}`, () => {
    it('responde NearbyStopsResponse com raio padrão', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.nearbyStops)
        .query({ lat: '-23.5614', lon: '-46.6559' })
        .expect(200);
      const body = NearbyStopsResponseSchema.parse(res.body);
      expect(body.stops).toEqual([expect.objectContaining({ id: '4301848', distanceM: 0 })]);
    });

    it.each([
      { lat: 'x', lon: '-46.6' },
      { lat: '-23.5', lon: '-46.6', radius: '2001' },
      { lat: '-23.5', lon: '-46.6', radius: '1.5' },
      { lon: '-46.6' },
    ])('responde 400 para %p', async (query) => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.nearbyStops)
        .query(query)
        .expect(400);
      expect(ApiErrorBodySchema.parse(res.body).code).toBe('INVALID_QUERY');
    });
  });

  describe('GET stopArrivals', () => {
    it('responde StopArrivalsResponse ordenado por expectedAt', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.stopArrivals('4301848'))
        .expect(200);
      const body = StopArrivalsResponseSchema.parse(res.body);
      expect(body.stopId).toBe('4301848');
      expect(body.arrivals.map((a) => a.vehicleId)).toEqual(['11433', '11502']);
      expect(body.arrivals[0]).toMatchObject({
        routeId: '875A-10',
        routeColor: '509E2F',
        routeTextColor: 'FFFFFF',
        directionId: 0,
        isRealtime: true,
      });
    });

    it('responde 503 ApiErrorBody quando a Olho Vivo falha', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.stopArrivals('4200953'))
        .expect(503);
      const body = ApiErrorBodySchema.parse(res.body);
      expect(body.code).toBe('SOURCE_UNAVAILABLE');
      // Texto amigável da fonte, sem nome interno nem variável de configuração.
      expect(body.message).toMatch(/Olho Vivo/);
      expect(body.message).not.toMatch(/OLHOVIVO_TOKEN|olho-vivo/);
    });

    it('parada que não existe responde 404 ApiErrorBody', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.stopArrivals('nope123'))
        .expect(404);
      expect(ApiErrorBodySchema.parse(res.body)).toEqual({
        code: 'STOP_NOT_FOUND',
        message: 'Parada nope123 não encontrada.',
      });
    });

    it('validação em português', async () => {
      const res = await request(app.getHttpServer())
        .get(API_PATHS.nearbyStops)
        .query({ lat: 'abc', lon: '-46.6' })
        .expect(400);
      expect(ApiErrorBodySchema.parse(res.body).message).toBe(
        'Parâmetros inválidos (lat: deve ser um número).',
      );
    });
  });
});
