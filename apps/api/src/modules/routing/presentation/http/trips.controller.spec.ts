import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { API_PATHS, ApiErrorBodySchema, PlanTripResponseSchema } from '@baldeacao/types';
import { tripRequestExample } from '@baldeacao/types/examples';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  FixedClock,
  fakeOtpFetch,
  readOtpFixture,
} from '../../../../../test/support/routing-in-memory';
import {
  InMemoryServiceCalendar,
  InMemoryStopRepository,
} from '../../../../../test/support/transit-in-memory';
import { GetServicePeriodUseCase } from '../../../transit/application/use-cases/get-service-period.use-case';
import { ServiceCalendarRepository } from '../../../transit/domain/ports/service-calendar.port';
import { HasNearbyStopUseCase } from '../../../transit/application/use-cases/has-nearby-stop.use-case';
import { Stop } from '../../../transit/domain/entities/stop.entity';
import { StopRepository } from '../../../transit/domain/ports/stop-repository.port';
import { PlanTripUseCase } from '../../application/use-cases/plan-trip.use-case';
import { Clock } from '../../domain/ports/clock.port';
import { TripPlanner } from '../../domain/ports/trip-planner.port';
import { OtpClient } from '../../infrastructure/adapters/otp.client';
import { OtpTripPlannerAdapter } from '../../infrastructure/adapters/otp-trip-planner.adapter';
import { TripsController } from './trips.controller';

// Só a origem do exemplo tem parada perto: o destino fica fora da área atendida.
const ORIGIN_STOP = new Stop({
  id: 'A',
  sourceId: 'sptrans',
  code: null,
  name: 'Parada A',
  description: null,
  location: tripRequestExample.from,
});

async function appWith(client: OtpClient): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    controllers: [TripsController],
    providers: [
      PlanTripUseCase,
      HasNearbyStopUseCase,
      GetServicePeriodUseCase,
      { provide: StopRepository, useValue: new InMemoryStopRepository([ORIGIN_STOP]) },
      { provide: ServiceCalendarRepository, useValue: new InMemoryServiceCalendar() },
      { provide: Clock, useValue: new FixedClock() },
      { provide: OtpClient, useValue: client },
      { provide: TripPlanner, useClass: OtpTripPlannerAdapter },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}

describe('HTTP do routing (contrato v2)', () => {
  let app: INestApplication<App>;
  let fetchFn: ReturnType<typeof fakeOtpFetch>;

  beforeAll(async () => {
    fetchFn = fakeOtpFetch(readOtpFixture('plan-connection-bus-subway.json'));
    app = await appWith(new OtpClient({ baseUrl: 'http://otp.test', fetch: fetchFn, retries: 0 }));
  });
  afterAll(() => app?.close());

  it('POST /trips/plan devolve PlanTripResponse com baldeação ônibus + metrô', async () => {
    const res = await request(app.getHttpServer())
      .post(API_PATHS.planTrip)
      .send(tripRequestExample)
      .expect(200);
    const body = PlanTripResponseSchema.parse(res.body);
    expect(body.itineraries).toHaveLength(2);
    expect(body.itineraries[0]?.legs.map((leg) => leg.mode)).toEqual([
      'walk',
      'bus',
      'walk',
      'subway',
      'walk',
    ]);
    expect(body.itineraries[0]?.legs[1]?.routeId).toBe('7725-10');
    expect(body.notices).toEqual(['destination_outside_service_area']);
  });

  it('maxItineraries limita a resposta (padrão do contrato aplicado)', async () => {
    const res = await request(app.getHttpServer())
      .post(API_PATHS.planTrip)
      .send({ ...tripRequestExample, maxItineraries: 1 })
      .expect(200);
    expect(PlanTripResponseSchema.parse(res.body).itineraries).toHaveLength(1);

    const { from, to } = tripRequestExample;
    await request(app.getHttpServer()).post(API_PATHS.planTrip).send({ from, to }).expect(200);
    const last = fetchFn.calls[fetchFn.calls.length - 1]?.body as {
      variables: { first: number; dateTime?: unknown };
    };
    expect(last.variables.first).toBe(12);
    expect(last.variables.dateTime).toBeUndefined();
  });

  it.each([
    [{}],
    [{ from: { lat: -23.6, lon: -46.7 } }],
    [{ ...tripRequestExample, arriveBy: '2026-11-12T09:00:00-03:00' }],
    [{ ...tripRequestExample, maxItineraries: 6 }],
    [{ ...tripRequestExample, departAt: 'amanhã' }],
  ])('corpo inválido vira 400 com ApiErrorBody (%j)', async (body) => {
    const res = await request(app.getHttpServer()).post(API_PATHS.planTrip).send(body).expect(400);
    expect(ApiErrorBodySchema.parse(res.body).code).toBe('INVALID_QUERY');
  });

  it('OTP indisponível ou OTP_URL ausente vira 503 com ApiErrorBody', async () => {
    for (const client of [
      new OtpClient({ baseUrl: 'http://otp.test', fetch: fakeOtpFetch('erro', 502), retries: 0 }),
      new OtpClient({ baseUrl: undefined }),
    ]) {
      const down = await appWith(client);
      const res = await request(down.getHttpServer())
        .post(API_PATHS.planTrip)
        .send(tripRequestExample)
        .expect(503);
      expect(ApiErrorBodySchema.parse(res.body).code).toBe('SOURCE_UNAVAILABLE');
      await down.close();
    }
  });
});
