import { itineraryExample } from '@baldeacao/types/examples';
import { InMemoryTripPlanner } from '../../../../../test/support/routing-in-memory';
import { InMemoryStopRepository } from '../../../../../test/support/transit-in-memory';
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
): PlanTripUseCase {
  return new PlanTripUseCase(planner, new HasNearbyStopUseCase(new InMemoryStopRepository(stops)));
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
    expect(planner.queries).toEqual([
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
      arriveBy: '2026-11-12T09:00:00Z',
      maxItineraries: 9,
    });
    await useCase.execute({ from: FROM, to: TO, maxItineraries: 0 });

    expect(out.itineraries).toHaveLength(2);
    expect(planner.queries.map((q) => [q.time, q.maxItineraries, q.candidates])).toEqual([
      [{ departAt }, 2, 12],
      [{ arriveBy: '2026-11-12T09:00:00Z' }, 5, 20],
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
    expect(planner.queries).toHaveLength(0);
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
    expect(planner.queries).toHaveLength(2);
  });
});
