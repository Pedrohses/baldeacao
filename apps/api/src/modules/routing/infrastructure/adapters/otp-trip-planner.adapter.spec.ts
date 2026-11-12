import { ItinerarySchema } from '@baldeacao/types';
import { fakeOtpFetch, readOtpFixture } from '../../../../../test/support/routing-in-memory';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { groupItineraries } from '../../domain/value-objects/itinerary-grouping';
import type { TripPlanQuery } from '../../domain/value-objects/trip-plan-query';
import { OtpClient } from './otp.client';
import { stripFeedPrefix, tripModeFromOtp } from './otp-itinerary.mapper';
import { OTP_PLAN_CONNECTION_QUERY } from './otp-plan-connection.query';
import { OtpTripPlannerAdapter } from './otp-trip-planner.adapter';

const QUERY: TripPlanQuery = {
  from: { lat: -23.6, lon: -46.7202 },
  to: { lat: -23.5342, lon: -46.6339 },
  time: { departAt: '2026-11-12T08:00:00-03:00' },
  maxItineraries: 3,
  candidates: 12,
};

function plannerWith(fetchFn: typeof fetch, baseUrl: string | null = 'http://otp.test:8080') {
  return new OtpTripPlannerAdapter(
    new OtpClient({ baseUrl: baseUrl ?? undefined, fetch: fetchFn, retries: 0 }),
  );
}

describe('OtpTripPlannerAdapter', () => {
  it('envia planConnection para /otp/gtfs/v1 com origem, destino, hora e quantidade', async () => {
    const fetchFn = fakeOtpFetch(readOtpFixture('plan-connection-bus-subway.json'));
    await plannerWith(fetchFn).plan(QUERY);

    expect(fetchFn.calls).toHaveLength(1);
    const [call] = fetchFn.calls as [(typeof fetchFn.calls)[number]];
    expect(call.url).toBe('http://otp.test:8080/otp/gtfs/v1');
    expect(call.body).toEqual({
      query: OTP_PLAN_CONNECTION_QUERY,
      variables: {
        origin: {
          label: 'Origem',
          location: { coordinate: { latitude: -23.6, longitude: -46.7202 } },
        },
        destination: {
          label: 'Destino',
          location: { coordinate: { latitude: -23.5342, longitude: -46.6339 } },
        },
        dateTime: { earliestDeparture: '2026-11-12T08:00:00-03:00' },
        first: 12,
      },
    });
  });

  it('chegada até vira latestArrival; sem hora não manda dateTime', async () => {
    const fetchFn = fakeOtpFetch(readOtpFixture('plan-connection-no-route.json'));
    const planner = plannerWith(fetchFn);
    await planner.plan({ ...QUERY, time: { arriveBy: '2026-11-12T09:00:00-03:00' } });
    await planner.plan({ ...QUERY, time: null });
    const [arrive, now] = fetchFn.calls.map(
      (c) => (c.body as { variables: Record<string, unknown> }).variables,
    );
    expect(arrive?.dateTime).toEqual({ latestArrival: '2026-11-12T09:00:00-03:00' });
    expect(now).not.toHaveProperty('dateTime');
  });

  it('itinerário com baldeação ônibus + metrô da fixture vira Itinerary do contrato', async () => {
    const fetchFn = fakeOtpFetch(readOtpFixture('plan-connection-bus-subway.json'));
    const itineraries = await plannerWith(fetchFn).plan(QUERY);

    expect(itineraries).toHaveLength(2);
    for (const itinerary of itineraries) expect(ItinerarySchema.parse(itinerary)).toBeTruthy();

    const [transfer] = itineraries as [(typeof itineraries)[number]];
    expect(transfer).toMatchObject({
      startAt: '2026-11-12T08:00:00-03:00',
      endAt: '2026-11-12T08:52:00-03:00',
      durationS: 3120,
      walkDistanceM: 750,
      transfers: 1,
    });
    expect(transfer.legs.map((leg) => leg.mode)).toEqual(['walk', 'bus', 'walk', 'subway', 'walk']);

    const [walk, bus, , subway] = transfer.legs as [
      (typeof transfer.legs)[number],
      (typeof transfer.legs)[number],
      (typeof transfer.legs)[number],
      (typeof transfer.legs)[number],
    ];
    expect(walk).toMatchObject({
      from: { name: 'Origem', stopId: null },
      to: { name: 'Av. Giovanni Gronchi, 4990', stopId: '1906488' },
      routeId: null,
      routeShortName: null,
      routeColor: null,
      headsign: null,
      intermediateStops: 0,
      isRealtime: false,
    });
    expect(walk.points).toEqual([
      { lat: -23.6, lon: -46.7202 },
      { lat: -23.6006, lon: -46.7214 },
      { lat: -23.6012, lon: -46.7225 },
    ]);
    expect(bus).toMatchObject({
      routeId: '7725-10',
      routeShortName: '7725-10',
      routeColor: '509E2F',
      headsign: 'Rio Pequeno',
      intermediateStops: 9,
      isRealtime: true,
      // Horário previsto em tempo real no lugar do programado.
      startAt: '2026-11-12T08:08:00-03:00',
      endAt: '2026-11-12T08:26:00-03:00',
      durationS: 1080,
      distanceM: 4200,
    });
    expect(bus.points).toHaveLength(4);
    expect(subway).toMatchObject({
      routeId: 'L4',
      routeShortName: 'L4',
      routeColor: 'FFD400',
      isRealtime: false,
      from: { stopId: '18853' },
      to: { name: 'Luz', stopId: '18845' },
      intermediateStops: 7,
    });
    expect(subway.points).toHaveLength(5);

    const [, direct] = itineraries as [unknown, (typeof itineraries)[number]];
    expect(direct.transfers).toBe(0);
    expect(direct.legs[1]).toMatchObject({ routeId: '875A-10', routeColor: null });
  });

  it('sem conexão (routingErrors) devolve lista vazia', async () => {
    const fetchFn = fakeOtpFetch(readOtpFixture('plan-connection-no-route.json'));
    await expect(plannerWith(fetchFn).plan(QUERY)).resolves.toEqual([]);
  });

  it('erro de GraphQL, HTTP 5xx, rede ou OTP_URL ausente viram SourceUnavailableError', async () => {
    const cases: Array<Promise<unknown>> = [
      plannerWith(fakeOtpFetch(readOtpFixture('graphql-validation-error.json'))).plan(QUERY),
      plannerWith(fakeOtpFetch('erro', 503)).plan(QUERY),
      plannerWith(fakeOtpFetch('não encontrado', 404)).plan(QUERY),
      plannerWith(() => Promise.reject(new TypeError('fetch failed'))).plan(QUERY),
    ];
    for (const promise of cases)
      await expect(promise).rejects.toBeInstanceOf(SourceUnavailableError);

    const fetchFn = fakeOtpFetch('{}');
    await expect(plannerWith(fetchFn, null).plan(QUERY)).rejects.toThrow(/OTP_URL/);
    expect(fetchFn.calls).toHaveLength(0);
  });
});

describe('mapeamento do OTP', () => {
  it('modos do OTP para TripMode', () => {
    expect(
      ['WALK', 'BUS', 'COACH', 'TROLLEYBUS', 'SUBWAY', 'MONORAIL', 'RAIL', 'TRAM', 'FERRY'].map(
        (mode) => tripModeFromOtp(mode, mode !== 'WALK'),
      ),
    ).toEqual(['walk', 'bus', 'bus', 'trolleybus', 'subway', 'subway', 'rail', 'tram', 'ferry']);
    expect(tripModeFromOtp('AIRPLANE', true)).toBe('bus');
    expect(tripModeFromOtp(null, false)).toBe('walk');
  });

  it('tira o prefixo do feed só até o primeiro dois-pontos', () => {
    expect(stripFeedPrefix('1:875A-10')).toBe('875A-10');
    expect(stripFeedPrefix('sptrans:A:B')).toBe('A:B');
    expect(stripFeedPrefix('875A-10')).toBe('875A-10');
  });

  it('saídas repetidas do OTP local (fixture real, 12 itinerários) viram 4 opções distintas', async () => {
    const fetchFn = fakeOtpFetch(readOtpFixture('plan-connection-repeated-departures.json'));
    const raw = await plannerWith(fetchFn).plan(QUERY);
    expect(raw).toHaveLength(12);

    const grouped = groupItineraries(raw, 5);
    const lines = grouped.map((it) =>
      it.legs.filter((leg) => leg.mode !== 'walk').map((leg) => leg.routeShortName),
    );
    expect(lines).toEqual([
      ['METRÔ L4', '746H-10'],
      ['917H-10', 'METRÔ L4', '746H-10'],
      ['857R-10', 'METRÔ L4', '746H-10'],
      ['6262-10', '775F-10'],
    ]);
    expect(grouped.map((it) => it.startAt)).toEqual(
      Array(4).fill('2026-11-12T14:00:00-03:00') as string[],
    );
    expect(grouped.map((it) => it.alsoDepartsAt)).toEqual([
      ['2026-11-12T14:01:00-03:00', '2026-11-12T14:02:00-03:00', '2026-11-12T14:03:00-03:00'],
      ['2026-11-12T14:01:00-03:00'],
      ['2026-11-12T14:01:00-03:00'],
      undefined,
    ]);
    for (const it of grouped) expect(() => ItinerarySchema.parse(it)).not.toThrow();
    expect(groupItineraries(raw, 2)).toHaveLength(2);
  });
});
