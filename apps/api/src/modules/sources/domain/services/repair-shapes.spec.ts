import type { GtfsShape } from '../entities/gtfs-feed.entity';
import { isRailRouteType, repairShapes, type ShapeUsage } from './repair-shapes';
import { distanceMeters, type LatLon, longestSegment, pathLength } from './shape-geometry';

// Traçados sintéticos numa linha leste-oeste em -23.55, com metros convertidos em graus.
const LAT = -23.55;
const LON = -46.6;
const M_PER_DEG_LAT = (6371000 * Math.PI) / 180;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT * Math.PI) / 180);

function east(meters: number, northMeters = 0): LatLon {
  return { lat: LAT + northMeters / M_PER_DEG_LAT, lon: LON + meters / M_PER_DEG_LON };
}

/** Pontos a cada `step` metros de `from` a `to` (inclusive), para o leste. */
function line(from: number, to: number, step: number, northMeters = 0): LatLon[] {
  const points: LatLon[] = [];
  const direction = Math.sign(to - from);
  for (let m = from; direction * m <= direction * to; m += direction * step) {
    points.push(east(m, northMeters));
  }
  return points;
}

function rail(
  routeType = 2,
  firstStop: LatLon | null = null,
  lastStop: LatLon | null = null,
): ShapeUsage {
  return { rail: true, routeType, firstStop, lastStop };
}

function bus(firstStop: LatLon | null, lastStop: LatLon | null): ShapeUsage {
  return { rail: false, routeType: 3, firstStop, lastStop };
}

function byId(shapes: GtfsShape[], id: string): LatLon[] {
  const shape = shapes.find((s) => s.shapeId === id);
  if (!shape) throw new Error(`sem shape ${id}`);
  return shape.points;
}

describe('repairShapes', () => {
  it('remove o espinho de trilho (meia-volta com braços > 50 m) e mantém o de ônibus', () => {
    const spiky = [east(0), east(200), east(400), east(400, 120), east(400, 0.5), east(600)];
    // O vértice (400, 120) sai para o norte e volta: ângulo de retorno ~180 graus.
    const { shapes, actions } = repairShapes(
      [
        { shapeId: 'metro', points: spiky },
        { shapeId: 'onibus', points: spiky },
      ],
      new Map([
        ['metro', rail(1)],
        ['onibus', bus(null, null)],
      ]),
    );
    expect(byId(shapes, 'metro')).toHaveLength(5);
    expect(byId(shapes, 'metro')).not.toContainEqual(east(400, 120));
    expect(byId(shapes, 'onibus')).toHaveLength(6);
    expect(actions).toEqual([{ shapeId: 'metro', kind: 'spike-removed', meters: 120 }]);
  });

  it('não trata curva fechada com braço curto como espinho', () => {
    const points = [east(0), east(200), east(200, 30), east(0, 31)];
    const { actions } = repairShapes([{ shapeId: 'm', points }], new Map([['m', rail(1)]]));
    expect(actions).toEqual([]);
  });

  it('preenche o salto de trilho com os pontos de outro traçado que passa nas duas pontas', () => {
    const gappy = [...line(0, 1000, 100), ...line(5000, 6000, 100)];
    const donor = line(-500, 6500, 100, 40); // paralela, 40 m ao norte
    const { shapes, actions } = repairShapes(
      [
        { shapeId: 'trem', points: gappy },
        { shapeId: 'metro', points: donor },
      ],
      new Map([
        ['trem', rail(2)],
        ['metro', rail(1)],
      ]),
    );
    const repaired = byId(shapes, 'trem');
    expect(longestSegment(repaired)).toBeLessThan(150);
    expect(repaired.length).toBeGreaterThan(gappy.length + 30);
    expect(actions).toContainEqual({
      shapeId: 'trem',
      kind: 'gap-filled',
      meters: 4000,
      borrowedFrom: 'metro',
    });
  });

  it('empresta na ordem do salto mesmo se o doador corre no sentido contrário', () => {
    const gappy = [...line(0, 1000, 100), ...line(5000, 6000, 100)];
    const donor = line(6500, -500, 100, 20);
    const { shapes } = repairShapes(
      [
        { shapeId: 'trem', points: gappy },
        { shapeId: 'volta', points: donor },
      ],
      new Map([
        ['trem', rail()],
        ['volta', rail()],
      ]),
    );
    const repaired = byId(shapes, 'trem');
    // Sem vai e volta: o comprimento continua ~6 km.
    expect(pathLength(repaired)).toBeLessThan(6100);
    expect(longestSegment(repaired)).toBeLessThan(150);
  });

  it('mantém a reta quando nenhum traçado cobre o salto (nem o sentido oposto com o mesmo salto)', () => {
    const gappy = [...line(0, 1000, 100), ...line(5000, 6000, 100)];
    const { shapes, actions } = repairShapes(
      [
        { shapeId: 'ida', points: gappy },
        { shapeId: 'volta', points: [...gappy].reverse() },
        { shapeId: 'longe', points: line(0, 6000, 100, 400) },
      ],
      new Map([
        ['ida', rail()],
        ['volta', rail()],
        ['longe', rail()],
      ]),
    );
    expect(byId(shapes, 'ida')).toEqual(gappy);
    expect(actions).toEqual([]);
  });

  it('recusa doador que dá volta grande demais entre as pontas', () => {
    const gappy = [east(0), east(1000)];
    // Passa pelas duas pontas, mas sobe 1 km para o norte no meio.
    const detour = [east(0), east(0, 1000), east(1000, 1000), east(1000)];
    const { actions } = repairShapes(
      [
        { shapeId: 'trem', points: gappy },
        { shapeId: 'desvio', points: detour },
      ],
      new Map([
        ['trem', rail()],
        ['desvio', rail()],
      ]),
    );
    expect(actions).toEqual([]);
  });

  it('estende o início do trilho até a primeira parada com geometria de outra linha', () => {
    const stop = east(0, 30);
    const late = line(4000, 8000, 100); // começa 4 km depois da parada
    const donor = line(-200, 5000, 100);
    const { shapes, actions } = repairShapes(
      [
        { shapeId: 'l12', points: late },
        { shapeId: 'l11', points: donor },
      ],
      new Map([
        ['l12', rail(2, stop, east(8000))],
        ['l11', rail(2)],
      ]),
    );
    const repaired = byId(shapes, 'l12');
    expect(distanceMeters(repaired[0] ?? east(99999), stop)).toBeLessThan(150);
    expect(longestSegment(repaired)).toBeLessThan(150);
    expect(actions).toEqual([
      { shapeId: 'l12', kind: 'start-extended', meters: 4000, borrowedFrom: 'l11' },
    ]);
  });

  it('estende o fim com reta até a parada quando ninguém cobre (e ônibus sempre com reta)', () => {
    const short = line(0, 3000, 100);
    const lastStop = east(3600);
    const { shapes, actions } = repairShapes(
      [
        { shapeId: 'trem', points: short },
        { shapeId: 'onibus', points: short },
      ],
      new Map([
        ['trem', rail(2, east(0), lastStop)],
        ['onibus', bus(east(0), lastStop)],
      ]),
    );
    expect(byId(shapes, 'trem').at(-1)).toEqual(lastStop);
    expect(byId(shapes, 'onibus').at(-1)).toEqual(lastStop);
    expect(actions).toEqual([
      { shapeId: 'trem', kind: 'end-extended', meters: 600 },
      { shapeId: 'onibus', kind: 'end-extended', meters: 600 },
    ]);
  });

  it('corta a ponta que passa mais de 300 m da última parada, em qualquer modo', () => {
    const long = line(0, 5000, 100);
    const lastStop = east(3050, 20);
    const { shapes, actions } = repairShapes(
      [{ shapeId: 'onibus', points: long }],
      new Map([['onibus', bus(east(0), lastStop)]]),
    );
    const repaired = byId(shapes, 'onibus');
    expect(distanceMeters(repaired.at(-1) ?? east(0), east(3050))).toBeLessThan(2);
    expect(actions).toEqual([{ shapeId: 'onibus', kind: 'end-trimmed', meters: 1950 }]);
  });

  it('corta o começo que vem de antes da primeira parada', () => {
    const long = line(0, 5000, 100);
    const { shapes, actions } = repairShapes(
      [{ shapeId: 'trem', points: long }],
      new Map([['trem', rail(2, east(800), east(5000))]]),
    );
    expect(distanceMeters(byId(shapes, 'trem')[0] ?? east(0), east(800))).toBeLessThan(2);
    expect(actions).toEqual([{ shapeId: 'trem', kind: 'start-trimmed', meters: 800 }]);
  });

  it('não mexe em ponta dentro da tolerância, nem em linha circular, nem sem parada combinada', () => {
    const loop = [...line(0, 2000, 100), ...line(2000, 0, 100, 200)];
    const { actions } = repairShapes(
      [
        { shapeId: 'perto', points: line(0, 5000, 100) },
        { shapeId: 'circular', points: loop },
        { shapeId: 'sem-parada', points: line(0, 5000, 100) },
      ],
      new Map([
        ['perto', bus(east(-250), east(5250))],
        ['circular', bus(east(0), east(0))],
        ['sem-parada', bus(null, null)],
      ]),
    );
    expect(actions).toEqual([]);
  });
});

describe('isRailRouteType', () => {
  it.each([
    [0, true],
    [1, true],
    [2, true],
    [12, true],
    [109, true],
    [401, true],
    [3, false],
    [4, false],
    [700, false],
  ])('route_type %i -> %s', (routeType, expected) => {
    expect(isRailRouteType(routeType)).toBe(expected);
  });
});
