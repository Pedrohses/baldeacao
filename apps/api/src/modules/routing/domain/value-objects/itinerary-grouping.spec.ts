import { itineraryExample } from '@baldeacao/types/examples';
import type { Itinerary, Leg } from '../entities/itinerary.entity';
import { groupItineraries, hasSameLineTransfer, isDominated } from './itinerary-grouping';

const BUS = itineraryExample.legs.find((leg) => leg.mode === 'bus')!;

function leg(routeId: string): Leg {
  return { ...BUS, routeId, routeShortName: routeId };
}

function option(
  start: string,
  end: string,
  routes: string[],
  extra: Partial<Itinerary> = {},
): Itinerary {
  return {
    ...itineraryExample,
    startAt: `2026-11-12T${start}:00-03:00`,
    endAt: `2026-11-12T${end}:00-03:00`,
    durationS: 0,
    transfers: Math.max(0, routes.length - 1),
    walkDistanceM: 300,
    legs: routes.map(leg),
    ...extra,
  };
}

describe('groupItineraries', () => {
  it('descarta quem troca para a mesma linha quando há outra opção', () => {
    const loop = option('08:00', '08:40', ['3721-41', '3721-41', '407M-10']);
    const direct = option('08:05', '08:50', ['3721-41', '407M-10']);
    expect(hasSameLineTransfer(loop)).toBe(true);
    expect(groupItineraries([loop, direct], 3)).toEqual([direct]);
    // Sem alternativa, fica.
    expect(groupItineraries([loop], 3)).toEqual([loop]);
  });

  it('remove opção dominada e ordena por chegada e depois baldeações', () => {
    const four = option('23:30', '23:59', ['A', 'B', 'C', 'D', 'E']);
    const two = option('23:30', '23:59', ['F', 'G', 'H']);
    const later = option('23:40', '23:59', ['I']);
    expect(isDominated(four, two)).toBe(true);
    const out = groupItineraries([four, two, later], 3);
    expect(out.map((it) => it.legs[0]?.routeId)).toEqual(['I']);

    const slowDirect = option('23:30', '23:59', ['J'], { walkDistanceM: 900 });
    const out2 = groupItineraries([four, two, slowDirect], 3);
    expect(out2.map((it) => it.legs[0]?.routeId)).toEqual(['J', 'F']);
  });

  it('chegar até: chegada mais tardia primeiro, sem as que chegam 30 min antes', () => {
    const early = option('06:30', '07:23', ['A']);
    const close = option('07:00', '07:55', ['B', 'C']);
    const mid = option('06:50', '07:31', ['D']);
    const out = groupItineraries([early, close, mid], 3, { arriveBy: true });
    expect(out.map((it) => it.legs[0]?.routeId)).toEqual(['B', 'D']);
  });

  it('chegar até: o representante do grupo é a última saída que chega no limite', () => {
    const first = option('06:30', '07:20', ['A']);
    const last = option('07:00', '07:50', ['A']);
    const [out] = groupItineraries([first, last], 3, { arriveBy: true });
    expect(out?.startAt).toBe(last.startAt);
    expect(out?.alsoDepartsAt).toEqual([first.startAt]);
  });
});
