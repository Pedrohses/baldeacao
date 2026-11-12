import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  API_PATHS,
  ApiErrorBodySchema,
  LineDetailsResponseSchema,
  NearbyStopsResponseSchema,
  SearchLinesResponseSchema,
} from '@baldeacao/types';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  InMemoryRouteRepository,
  InMemoryStopRepository,
} from '../../../../../test/support/transit-in-memory';
import { FindNearbyStopsUseCase } from '../../application/use-cases/find-nearby-stops.use-case';
import { GetLineDetailsUseCase } from '../../application/use-cases/get-line-details.use-case';
import { SearchLinesUseCase } from '../../application/use-cases/search-lines.use-case';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import { LinesController } from './lines.controller';
import { StopsController } from './stops.controller';

describe('HTTP do transit (contrato v1)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LinesController, StopsController],
      providers: [
        SearchLinesUseCase,
        GetLineDetailsUseCase,
        FindNearbyStopsUseCase,
        { provide: RouteRepository, useValue: new InMemoryRouteRepository() },
        { provide: StopRepository, useValue: new InMemoryStopRepository() },
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
});
