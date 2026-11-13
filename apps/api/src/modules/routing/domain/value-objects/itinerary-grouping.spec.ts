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

describe('groupItineraries: ordem por custo (bug Tietê -> Aeroporto Guarulhos)', () => {
  const sampleLeg = itineraryExample.legs[1] as Leg;
  const leg = (mode: Leg['mode'], routeId: string | null): Leg => ({
    ...sampleLeg,
    mode,
    routeId,
    routeShortName: routeId,
  });
  const base = (
    startAt: string,
    walkDistanceM: number,
    transfers: number,
    routes: string[],
  ): Itinerary => ({
    ...itineraryExample,
    startAt,
    endAt: '2026-11-13T07:56:00-03:00',
    durationS: (Date.parse('2026-11-13T07:56:00-03:00') - Date.parse(startAt)) / 1000,
    walkDistanceM,
    transfers,
    legs: routes.map((r) => leg(r.startsWith('L') ? 'rail' : 'bus', r)),
  });

  it('com a mesma chegada, a opção que sai mais tarde e anda menos vem primeiro', () => {
    const bus = base('2026-11-13T06:38:00-03:00', 1700, 2, ['2105-10', 'L12', 'L13']);
    const metro = base('2026-11-13T06:55:00-03:00', 679, 3, ['L1', 'L11', 'L12', 'L13']);
    const [first] = groupItineraries([bus, metro], 3);
    expect(first?.legs.map((l) => l.routeId)).toEqual(['L1', 'L11', 'L12', 'L13']);
  });

  it('no mesmo grupo, a saída mais tarde que pega o mesmo trem é a representante', () => {
    const early = base('2026-11-13T06:30:00-03:00', 679, 3, ['L1', 'L11', 'L12', 'L13']);
    const late = base('2026-11-13T06:55:00-03:00', 679, 3, ['L1', 'L11', 'L12', 'L13']);
    const [first] = groupItineraries([early, late], 3);
    expect(first?.startAt).toBe('2026-11-13T06:55:00-03:00');
  });
});
