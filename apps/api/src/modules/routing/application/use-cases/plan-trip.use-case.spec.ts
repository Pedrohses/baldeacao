import { itineraryExample } from '@baldeacao/types/examples';
import { FixedClock, InMemoryTripPlanner } from '../../../../../test/support/routing-in-memory';
import {
  InMemoryServiceCalendar,
  InMemoryStopRepository,
} from '../../../../../test/support/transit-in-memory';
import {
  InMemoryKnownPlaceRepository,
  type KnownPlaceSeed,
} from '../../../../../test/support/geocoding-in-memory';
import { ResolvePlaceAccessUseCase } from '../../../geocoding/application/use-cases/resolve-place-access.use-case';
import { Place } from '../../../geocoding/domain/entities/place.entity';
import { FindAccessStopsUseCase } from '../../../transit/application/use-cases/find-access-stops.use-case';
import { GetServicePeriodUseCase } from '../../../transit/application/use-cases/get-service-period.use-case';
import { HasNearbyStopUseCase } from '../../../transit/application/use-cases/has-nearby-stop.use-case';
import { Stop } from '../../../transit/domain/entities/stop.entity';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import type { Itinerary } from '../../domain/entities/itinerary.entity';
import { InvalidTripRequestError } from '../../domain/errors/invalid-trip-request.error';
import { PlanTripUseCase } from './plan-trip.use-case';

const FROM = { lat: -23.6, lon: -46.7202 };
const TO = { lat: -23.5163, lon: -46.6252 };
const ITINERARY: Itinerary = itineraryExample;

function stopAt(id: string, location: { lat: number; lon: number }): Stop {
  return new Stop({ id, sourceId: 'sptrans', code: null, name: id, description: null, location });
}

/** Caso de uso com paradas junto da origem e do destino (área atendida), salvo outra lista. */
function planTrip(
  planner: InMemoryTripPlanner,
  stops: Stop[] = [stopAt('A', FROM), stopAt('B', TO)],
  clock = new FixedClock(),
  calendar = new InMemoryServiceCalendar(),
  known: KnownPlaceSeed[] = [],
  stationIds: string[] = [],
): PlanTripUseCase {
  const repository = new InMemoryStopRepository(stops);
  for (const id of stationIds) repository.stationIds.add(id);
  return new PlanTripUseCase(
    planner,
    new HasNearbyStopUseCase(repository),
    new GetServicePeriodUseCase(calendar),
    new ResolvePlaceAccessUseCase(
      new InMemoryKnownPlaceRepository(known),
      new FindAccessStopsUseCase(repository),
    ),
    clock,
  );
}

/** Consultas principais (sem a de alternativa, que exclui o modo dominante). */
function mainQueries(planner: InMemoryTripPlanner) {
  return planner.queries.filter((q) => !q.excludeModes);
}

/** Mesmo itinerário saindo `minutes` depois. */
function shifted(it: Itinerary, minutes: number): Itinerary {
  const move = (iso: string) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
  return {
    ...it,
    startAt: move(it.startAt),
    endAt: move(it.endAt),
    legs: it.legs.map((leg) => ({ ...leg, startAt: move(leg.startAt), endAt: move(leg.endAt) })),
  };
}

const WALK_ONLY: Itinerary = {
  ...shifted(ITINERARY, 30),
  transfers: 0,
  legs: [{ ...ITINERARY.legs[0]!, routeId: null }],
};
const OTHER_LINE: Itinerary = {
  ...shifted(ITINERARY, 10),
  legs: ITINERARY.legs.map((leg) => (leg.mode === 'bus' ? { ...leg, routeId: '875A-10' } : leg)),
};

describe('PlanTripUseCase', () => {
  it('sem hora parte agora e pede 3 itinerários por padrão', async () => {
    const planner = new InMemoryTripPlanner([ITINERARY]);
    const result = await planTrip(planner).execute({ from: FROM, to: TO });
    expect(result).toEqual({ itineraries: [ITINERARY], notices: [] });
    expect(mainQueries(planner)).toEqual([
      { from: FROM, to: TO, time: null, maxItineraries: 3, candidates: 12 },
    ]);
  });

  it('repassa saída ou chegada e limita a quantidade de 1 a 5', async () => {
    const planner = new InMemoryTripPlanner([ITINERARY, WALK_ONLY, OTHER_LINE]);
    const useCase = planTrip(planner);
    const departAt = '2026-11-12T08:00:00-03:00';
    const out = await useCase.execute({ from: FROM, to: TO, departAt, maxItineraries: 2 });
    await useCase.execute({
      from: FROM,
      to: TO,
      arriveBy: '2026-11-12T12:00:00Z',
      maxItineraries: 9,
    });
    await useCase.execute({ from: FROM, to: TO, maxItineraries: 0 });

    expect(out.itineraries).toHaveLength(2);
    expect(mainQueries(planner).map((q) => [q.time, q.maxItineraries, q.candidates])).toEqual([
      [{ departAt }, 2, 12],
      [{ arriveBy: '2026-11-12T12:00:00Z' }, 5, 20],
      [null, 1, 12],
    ]);
  });

  it.each([
    [{ departAt: '2026-11-12T08:00:00-03:00', arriveBy: '2026-11-12T09:00:00-03:00' }],
    [{ departAt: '2026-11-12T08:00:00' }],
    [{ arriveBy: 'amanhã cedo' }],
  ])('recusa hora inválida ou duplicada sem chamar o planejador (%j)', async (times) => {
    const planner = new InMemoryTripPlanner();
    await expect(
      planTrip(planner).execute({ from: FROM, to: TO, ...times }),
    ).rejects.toBeInstanceOf(InvalidTripRequestError);
    expect(mainQueries(planner)).toHaveLength(0);
  });

  it('recusa coordenada fora do intervalo', async () => {
    await expect(
      planTrip(new InMemoryTripPlanner()).execute({ from: { lat: 91, lon: 0 }, to: TO }),
    ).rejects.toBeInstanceOf(InvalidTripRequestError);
  });

  it('propaga SourceUnavailableError do planejador', async () => {
    const planner = new InMemoryTripPlanner(new SourceUnavailableError('otp'));
    await expect(planTrip(planner).execute({ from: FROM, to: TO })).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
  });

  it('agrupa saídas com as mesmas linhas e ordena os grupos pela chegada', async () => {
    const planner = new InMemoryTripPlanner([
      shifted(ITINERARY, 5),
      OTHER_LINE,
      ITINERARY,
      shifted(ITINERARY, 5),
      shifted(ITINERARY, 15),
      shifted(ITINERARY, 25),
      shifted(ITINERARY, 35),
      WALK_ONLY,
    ]);
    const { itineraries } = await planTrip(planner).execute({ from: FROM, to: TO });

    expect(itineraries.map((it) => [it.startAt, it.alsoDepartsAt])).toEqual([
      [
        ITINERARY.startAt,
        [
          shifted(ITINERARY, 5).startAt,
          shifted(ITINERARY, 15).startAt,
          shifted(ITINERARY, 25).startAt,
        ],
      ],
      [OTHER_LINE.startAt, undefined],
      [WALK_ONLY.startAt, undefined],
    ]);
    expect(itineraries[1]).not.toHaveProperty('alsoDepartsAt');
  });

  it('sem parada a 1 km da origem ou do destino avisa, mas ainda consulta o planejador', async () => {
    const planner = new InMemoryTripPlanner([ITINERARY]);
    const farFromTo = await planTrip(planner, [
      stopAt('A', { lat: -23.6005, lon: -46.7202 }),
    ]).execute({ from: FROM, to: TO });
    expect(farFromTo).toEqual({
      itineraries: [ITINERARY],
      notices: ['destination_outside_service_area'],
    });
    const nowhere = await planTrip(planner, []).execute({ from: FROM, to: TO });
    expect(nowhere.notices).toEqual([
      'origin_outside_service_area',
      'destination_outside_service_area',
    ]);
    expect(mainQueries(planner)).toHaveLength(2);
  });

  describe('avisos de data e hora', () => {
    it('hora que já passou vai para o mesmo horário no dia seguinte, com aviso', async () => {
      const planner = new InMemoryTripPlanner([ITINERARY]);
      // Agora: 12/11 às 16:00; pedido: 12/11 às 08:00.
      const useCase = planTrip(planner, undefined, new FixedClock('2026-11-12T16:00:00-03:00'));
      const out = await useCase.execute({
        from: FROM,
        to: TO,
        departAt: '2026-11-12T08:00:00-03:00',
      });
      expect(out.notices).toEqual(['time_in_past_moved']);
      expect(mainQueries(planner)[0]?.time).toEqual({ departAt: '2026-11-13T08:00:00-03:00' });

      // Dois dias atrás vai para amanhã, não para ontem; chegada também.
      await useCase.execute({ from: FROM, to: TO, arriveBy: '2026-11-10T09:30:00-03:00' });
      expect(mainQueries(planner)[1]?.time).toEqual({ arriveBy: '2026-11-13T09:30:00-03:00' });
    });

    it('data de mais de 1 dia atrás vai para o mesmo horário hoje, ou amanhã se já passou', async () => {
      const planner = new InMemoryTripPlanner([ITINERARY]);
      const useCase = planTrip(planner);
      const out = await useCase.execute({
        from: FROM,
        to: TO,
        departAt: '2025-01-01T08:00:00-03:00',
      });
      await useCase.execute({ from: FROM, to: TO, departAt: '2025-01-01T06:00:00-03:00' });
      expect(out.notices).toEqual(['time_in_past_moved']);
      expect(mainQueries(planner).map((q) => q.time)).toEqual([
        { departAt: '2026-11-12T08:00:00-03:00' },
        { departAt: '2026-11-13T06:00:00-03:00' },
      ]);
    });

    it('até 5 minutos no passado não move', async () => {
      const planner = new InMemoryTripPlanner([ITINERARY]);
      const useCase = planTrip(planner, undefined, new FixedClock('2026-11-12T08:04:00-03:00'));
      const out = await useCase.execute({
        from: FROM,
        to: TO,
        departAt: '2026-11-12T08:00:00-03:00',
      });
      expect(out.notices).toEqual([]);
      expect(mainQueries(planner)[0]?.time).toEqual({ departAt: '2026-11-12T08:00:00-03:00' });
    });

    it('data fora da validade do GTFS avisa date_outside_service (também para agora)', async () => {
      const planner = new InMemoryTripPlanner([]);
      const useCase = planTrip(planner);
      const out = await useCase.execute({
        from: FROM,
        to: TO,
        departAt: '2027-02-01T08:00:00-03:00',
      });
      expect(out.notices).toEqual(['date_outside_service']);

      const expired = planTrip(
        planner,
        undefined,
        new FixedClock('2026-11-12T07:00:00-03:00'),
        new InMemoryServiceCalendar({ startDate: '2025-01-01', endDate: '2026-06-30' }),
      );
      expect((await expired.execute({ from: FROM, to: TO })).notices).toEqual([
        'date_outside_service',
      ]);
      const noFeed = planTrip(planner, undefined, undefined, new InMemoryServiceCalendar(null));
      expect((await noFeed.execute({ from: FROM, to: TO })).notices).toEqual([]);
    });
  });

  describe('alternativa quando só há uma opção', () => {
    const subwayOnly: Itinerary = ITINERARY;
    const busOnly = (minutes: number, routeId = '6262-10'): Itinerary => ({
      ...shifted(ITINERARY, 0),
      durationS: minutes * 60,
      legs: ITINERARY.legs.map((leg) =>
        leg.mode === 'subway' ? { ...leg, mode: 'bus', routeId } : leg,
      ),
    });

    class TwoAnswerPlanner extends InMemoryTripPlanner {
      constructor(private readonly alternative: Itinerary[] | Error) {
        super([subwayOnly]);
      }
      override plan(query: Parameters<InMemoryTripPlanner['plan']>[0]) {
        if (!query.excludeModes) return super.plan(query);
        this.queries.push(query);
        return this.alternative instanceof Error
          ? Promise.reject(this.alternative)
          : Promise.resolve(this.alternative);
      }
    }

    it('consulta sem o modo dominante e acrescenta a melhor se durar até 1,5x', async () => {
      const ok = busOnly(Math.round((subwayOnly.durationS * 1.4) / 60));
      const planner = new TwoAnswerPlanner([busOnly(999, '775F-10'), ok]);
      const out = await planTrip(planner).execute({ from: FROM, to: TO });
      expect(out.itineraries).toEqual([subwayOnly, ok]);
      // No exemplo o metrô tem mais tempo de veículo (30 min contra 18 de ônibus).
      expect(planner.queries[1]?.excludeModes).toEqual(['subway', 'rail']);
    });

    it('alternativa longa demais, falha da segunda consulta ou 1 opção pedida: só a primeira', async () => {
      const long = new TwoAnswerPlanner([busOnly(Math.ceil((subwayOnly.durationS * 2) / 60))]);
      expect((await planTrip(long).execute({ from: FROM, to: TO })).itineraries).toEqual([
        subwayOnly,
      ]);
      const failing = new TwoAnswerPlanner(new SourceUnavailableError('otp'));
      expect((await planTrip(failing).execute({ from: FROM, to: TO })).itineraries).toEqual([
        subwayOnly,
      ]);
      const single = new TwoAnswerPlanner([busOnly(1)]);
      await planTrip(single).execute({ from: FROM, to: TO, maxItineraries: 1 });
      expect(single.queries).toHaveLength(1);
    });
  });

  it('madrugada pede janela de 3 h; de dia, a janela padrão', async () => {
    const planner = new InMemoryTripPlanner([]);
    const out = await planTrip(planner).execute({
      from: FROM,
      to: TO,
      departAt: '2026-11-13T01:30:00-03:00',
    });
    await planTrip(planner).execute({ from: FROM, to: TO, departAt: '2026-11-13T10:00:00-03:00' });
    expect(mainQueries(planner).map((q) => q.searchWindowMin)).toEqual([180, undefined]);
    expect(out).toEqual({ itineraries: [], notices: [] });
  });

  describe('ponto de acesso de terminais e aeroporto', () => {
    const tiete = new Place({
      id: 'osm:relation:8546826',
      name: 'Terminal Rodoviário Tietê',
      address: null,
      kind: 'poi',
      location: { lat: -23.516319, lon: -46.623732 },
    });
    const airport = new Place({
      id: 'osm:relation:5141542',
      name: 'Aeroporto Internacional Governador André Franco Montoro',
      address: null,
      kind: 'poi',
      location: { lat: -23.433452, lon: -46.47125 },
    });
    const metro = stopAt('18877', { lat: -23.516067, lon: -46.625162 });
    const busStop = stopAt('B1', { lat: -23.5165, lon: -46.6239 });
    const cptm = new Stop({
      ...stopAt('1814713', { lat: -23.433667, lon: -46.493732 }),
      name: 'Aeroporto Guarulhos',
    });
    const known: KnownPlaceSeed[] = [
      { place: tiete, importance: 10, category: 'amenity=bus_station' },
      { place: airport, importance: 11, category: 'aeroway=aerodrome' },
    ];

    it('terminal sai pela estação ao lado e aeroporto chega pela estação, com aviso', async () => {
      const planner = new InMemoryTripPlanner([ITINERARY]);
      const out = await planTrip(planner, [metro, busStop, cptm], undefined, undefined, known, [
        '18877',
        '1814713',
      ]).execute({ from: tiete.location, to: airport.location, maxItineraries: 1 });
      expect(mainQueries(planner)[0]).toMatchObject({
        from: metro.location,
        to: cptm.location,
      });
      expect(out.notices).toEqual(['airport_shuttle']);
    });

    it('a estação do aeroporto escolhida direto também avisa do ônibus gratuito', async () => {
      const planner = new InMemoryTripPlanner([ITINERARY]);
      const out = await planTrip(
        planner,
        [metro, cptm],
        undefined,
        undefined,
        [],
        ['18877', '1814713'],
      ).execute({ from: metro.location, to: cptm.location, maxItineraries: 1 });
      expect(mainQueries(planner)[0]).toMatchObject({ from: metro.location, to: cptm.location });
      expect(out.notices).toEqual(['airport_shuttle']);
    });

    it('aeroporto com parada a pé (Congonhas) usa a parada, sem aviso', async () => {
      const congonhas = new Place({ ...airport, id: 'osm:way:7', name: 'Aeroporto de Congonhas' });
      const walkable = stopAt('C1', { lat: -23.4364, lon: -46.47125 });
      const planner = new InMemoryTripPlanner([ITINERARY]);
      const out = await planTrip(
        planner,
        [metro, walkable, cptm],
        undefined,
        undefined,
        [{ place: congonhas, importance: 11, category: 'aeroway=aerodrome' }],
        ['18877', '1814713'],
      ).execute({ from: metro.location, to: congonhas.location, maxItineraries: 1 });
      expect(mainQueries(planner)[0]?.to).toEqual(walkable.location);
      expect(out.notices).toEqual([]);
    });

    it('ponto que não é lugar conhecido fica como está', async () => {
      const planner = new InMemoryTripPlanner([ITINERARY]);
      await planTrip(planner).execute({ from: FROM, to: TO });
      expect(mainQueries(planner)[0]).toMatchObject({ from: FROM, to: TO });
    });
  });
});
