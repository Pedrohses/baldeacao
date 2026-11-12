import { itineraryExample } from '@baldeacao/types/examples';
import { InMemoryTripPlanner } from '../../../../../test/support/routing-in-memory';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import type { Itinerary } from '../../domain/entities/itinerary.entity';
import { InvalidTripRequestError } from '../../domain/errors/invalid-trip-request.error';
import { PlanTripUseCase } from './plan-trip.use-case';

const FROM = { lat: -23.6, lon: -46.7202 };
const TO = { lat: -23.5163, lon: -46.6252 };
const ITINERARY: Itinerary = itineraryExample;

describe('PlanTripUseCase', () => {
  it('sem hora parte agora e pede 3 itinerários por padrão', async () => {
    const planner = new InMemoryTripPlanner([ITINERARY]);
    const result = await new PlanTripUseCase(planner).execute({ from: FROM, to: TO });
    expect(result).toEqual({ itineraries: [ITINERARY] });
    expect(planner.queries).toEqual([{ from: FROM, to: TO, time: null, maxItineraries: 3 }]);
  });

  it('repassa saída ou chegada e limita a quantidade de 1 a 5', async () => {
    const planner = new InMemoryTripPlanner([ITINERARY, ITINERARY, ITINERARY]);
    const useCase = new PlanTripUseCase(planner);
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
    expect(planner.queries.map((q) => [q.time, q.maxItineraries])).toEqual([
      [{ departAt }, 2],
      [{ arriveBy: '2026-11-12T09:00:00Z' }, 5],
      [null, 1],
    ]);
  });

  it.each([
    [{ departAt: '2026-11-12T08:00:00-03:00', arriveBy: '2026-11-12T09:00:00-03:00' }],
    [{ departAt: '2026-11-12T08:00:00' }],
    [{ arriveBy: 'amanhã cedo' }],
  ])('recusa hora inválida ou duplicada sem chamar o planejador (%j)', async (times) => {
    const planner = new InMemoryTripPlanner();
    await expect(
      new PlanTripUseCase(planner).execute({ from: FROM, to: TO, ...times }),
    ).rejects.toBeInstanceOf(InvalidTripRequestError);
    expect(planner.queries).toHaveLength(0);
  });

  it('recusa coordenada fora do intervalo', async () => {
    await expect(
      new PlanTripUseCase(new InMemoryTripPlanner()).execute({ from: { lat: 91, lon: 0 }, to: TO }),
    ).rejects.toBeInstanceOf(InvalidTripRequestError);
  });

  it('propaga SourceUnavailableError do planejador', async () => {
    const planner = new InMemoryTripPlanner(new SourceUnavailableError('otp'));
    await expect(
      new PlanTripUseCase(planner).execute({ from: FROM, to: TO }),
    ).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});
