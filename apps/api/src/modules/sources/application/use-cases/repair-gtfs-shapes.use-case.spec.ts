import type {
  GtfsRoute,
  GtfsShapePoint,
  GtfsStop,
  GtfsStopTime,
  GtfsTrip,
  RawGtfsFeed,
} from '../../domain/entities/gtfs-feed.entity';
import { RepairGtfsShapesUseCase } from './repair-gtfs-shapes.use-case';

async function* from<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield await Promise.resolve(item);
}

const M_PER_DEG = (6371000 * Math.PI) / 180;
const COS = Math.cos((-23.55 * Math.PI) / 180);
const lonAt = (meters: number) => -46.6 + meters / (M_PER_DEG * COS);

function shapeLine(shapeId: string, fromM: number, toM: number): GtfsShapePoint[] {
  const points: GtfsShapePoint[] = [];
  for (let m = fromM, seq = 1; m <= toM; m += 100, seq++) {
    points.push({ shapeId, lat: -23.55, lon: lonAt(m), sequence: seq });
  }
  return points;
}

function stop(stopId: string, meters: number): GtfsStop {
  return { stopId, code: null, name: stopId, description: null, lat: -23.55, lon: lonAt(meters) };
}

function route(routeId: string, routeType: number): GtfsRoute {
  return {
    routeId,
    agencyId: null,
    shortName: routeId,
    longName: '',
    routeType,
    color: null,
    textColor: null,
  };
}

function trip(tripId: string, routeId: string, shapeId: string): GtfsTrip {
  return { tripId, routeId, serviceId: 'U', headsign: null, directionId: 0, shapeId };
}

function stopTime(tripId: string, stopId: string, stopSequence: number): GtfsStopTime {
  return { tripId, stopId, stopSequence, arrivalTime: null, departureTime: null };
}

function feed(parts: {
  routes: GtfsRoute[];
  trips: GtfsTrip[];
  stops: GtfsStop[];
  stopTimes: GtfsStopTime[];
  shapePoints: GtfsShapePoint[];
}): RawGtfsFeed {
  return {
    routes: () => from(parts.routes),
    stops: () => from(parts.stops),
    trips: () => from(parts.trips),
    stopTimes: () => from(parts.stopTimes),
    calendar: () => from([]),
    frequencies: () => from([]),
    shapePoints: () => from(parts.shapePoints),
  };
}

describe('RepairGtfsShapesUseCase', () => {
  it('usa as paradas das pontas de cada viagem e o modo da rota', async () => {
    const result = await new RepairGtfsShapesUseCase().execute(
      feed({
        routes: [route('bus', 3), route('trem', 2)],
        trips: [trip('t1', 'bus', 's1'), trip('t2', 'trem', 's2')],
        stops: [stop('a', 0), stop('b', 3000), stop('c', 3600)],
        // stop_times fora de ordem: vale a sequência, não a ordem do arquivo.
        stopTimes: [
          stopTime('t1', 'b', 2),
          stopTime('t1', 'a', 1),
          stopTime('t2', 'c', 9),
          stopTime('t2', 'a', 1),
        ],
        shapePoints: [...shapeLine('s1', 0, 5000), ...shapeLine('s2', 0, 3000)],
      }),
    );
    expect(result.actions).toEqual([
      { shapeId: 's1', kind: 'end-trimmed', meters: 2000 },
      { shapeId: 's2', kind: 'end-extended', meters: 600 },
    ]);
    expect(result.shapes.find((s) => s.shapeId === 's2')?.points.at(-1)?.lon).toBeCloseTo(
      lonAt(3600),
      9,
    );
  });

  it('não mexe nas pontas quando as viagens do traçado discordam ou têm uma parada só', async () => {
    const result = await new RepairGtfsShapesUseCase().execute(
      feed({
        routes: [route('bus', 3)],
        trips: [trip('t1', 'bus', 's1'), trip('t2', 'bus', 's1'), trip('t3', 'bus', 's2')],
        stops: [stop('a', 0), stop('b', 1000), stop('c', 2000)],
        stopTimes: [
          stopTime('t1', 'a', 1),
          stopTime('t1', 'b', 2),
          stopTime('t2', 'a', 1),
          stopTime('t2', 'c', 2),
          stopTime('t3', 'a', 1),
        ],
        shapePoints: [...shapeLine('s1', 0, 5000), ...shapeLine('s2', 0, 5000)],
      }),
    );
    expect(result.actions).toEqual([]);
  });

  it('separa shapes com menos de dois pontos', async () => {
    const result = await new RepairGtfsShapesUseCase().execute(
      feed({
        routes: [],
        trips: [],
        stops: [],
        stopTimes: [],
        shapePoints: [...shapeLine('ok', 0, 200), { shapeId: 'um', lat: 0, lon: 0, sequence: 1 }],
      }),
    );
    expect(result.shapes.map((s) => s.shapeId)).toEqual(['ok']);
    expect(result.skipped).toEqual(['um']);
  });
});
