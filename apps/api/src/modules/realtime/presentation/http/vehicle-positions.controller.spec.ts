import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PATHS, ApiErrorBodySchema, VehicleSnapshotSchema } from '@baldeacao/types';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  InMemoryPositionsStore,
  rawPositionsFixture,
} from '../../../../../test/realtime/in-memory-realtime';
import { GetVehicleSnapshotUseCase } from '../../application/use-cases/get-vehicle-snapshot.use-case';
import { VehiclePositionsStorePort } from '../../domain/ports/vehicle-positions-store.port';
import { mapOlhoVivoPositions } from '../../infrastructure/adapters/olho-vivo-position.mapper';
import { VehiclePositionsController } from './vehicle-positions.controller';

describe('GET /vehicles/positions', () => {
  let app: INestApplication<App>;
  let store: InMemoryPositionsStore;

  beforeEach(async () => {
    store = new InMemoryPositionsStore();
    const moduleRef = await Test.createTestingModule({
      controllers: [VehiclePositionsController],
      providers: [
        GetVehicleSnapshotUseCase,
        { provide: VehiclePositionsStorePort, useValue: store },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterEach(() => app.close());

  const fill = () =>
    store.replace(
      'sptrans',
      mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans'),
      '2026-11-12T15:34:30.000Z',
    );

  it('responde VehicleSnapshot com todas as linhas', async () => {
    await fill();

    const response = await request(app.getHttpServer()).get(API_PATHS.vehiclePositions).expect(200);

    const snapshot = VehicleSnapshotSchema.parse(response.body);
    expect(snapshot.routeId).toBeNull();
    expect(snapshot.vehicles).toHaveLength(4);
  });

  it('filtra por routeId', async () => {
    await fill();

    const response = await request(app.getHttpServer())
      .get(API_PATHS.vehiclePositions)
      .query({ routeId: '8000-10' })
      .expect(200);

    const snapshot = VehicleSnapshotSchema.parse(response.body);
    expect(snapshot.routeId).toBe('8000-10');
    expect(snapshot.vehicles.map((v) => v.vehicleId)).toEqual(['18048']);
  });

  it('400 com ApiErrorBody para routeId vazio', async () => {
    await fill();

    const response = await request(app.getHttpServer())
      .get(`${API_PATHS.vehiclePositions}?routeId=`)
      .expect(400);

    expect(ApiErrorBodySchema.parse(response.body).code).toBe('INVALID_QUERY');
  });

  it('503 com ApiErrorBody antes do primeiro ciclo do worker', async () => {
    const response = await request(app.getHttpServer()).get(API_PATHS.vehiclePositions).expect(503);

    expect(ApiErrorBodySchema.parse(response.body).code).toBe('REALTIME_DATA_NOT_READY');
  });
});
