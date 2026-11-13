import type { GtfsShape } from '../entities/gtfs-feed.entity';
import {
  at,
  cumulativeDistances,
  distanceMeters,
  type LatLon,
  longestSegment,
  nearestPosition,
  passesNear,
  pathLength,
  vectorMeters,
} from './shape-geometry';

// Reparo dos traçados do GTFS antes de gravar (Postgres) ou de gerar o grafo (OTP).
// Os defeitos vêm do GTFS da SPTrans: metrô e trem com vai e volta na estação, retas
// longas onde faltam pontos (CPTM Brás-Tatuapé), traçado que não chega à primeira
// parada (CPTM L12 começa no Tatuapé) e traçado que segue além da última parada.

export interface ShapeRepairOptions {
  /** Ângulo de retorno (graus) acima do qual um ponto vira espinho. */
  spikeAngleDeg: number;
  /** Comprimento mínimo (m) dos dois braços do espinho. */
  spikeArmMeters: number;
  /** Segmento (m) acima do qual um traçado de trilho é tratado como salto. */
  gapMeters: number;
  /** Distância máxima (m) entre o ponto e o traçado de onde se empresta a geometria. */
  borrowRadiusMeters: number;
  /** Distância (m) entre a parada da ponta e a ponta do traçado tolerada sem reparo. */
  endToleranceMeters: number;
  /** Trecho emprestado pode ter até esta razão sobre a distância em linha reta. */
  maxDetourRatio: number;
}

export const DEFAULT_SHAPE_REPAIR_OPTIONS: ShapeRepairOptions = {
  spikeAngleDeg: 150,
  spikeArmMeters: 50,
  gapMeters: 500,
  borrowRadiusMeters: 150,
  endToleranceMeters: 300,
  maxDetourRatio: 1.5,
};

/** Metrô, trem, monotrilho, bonde e funicular, nos códigos básicos e estendidos do GTFS. */
export function isRailRouteType(routeType: number): boolean {
  if ([0, 1, 2, 5, 7, 12].includes(routeType)) return true;
  return (
    (routeType >= 100 && routeType < 200) ||
    (routeType >= 400 && routeType < 500) ||
    (routeType >= 900 && routeType < 1000) ||
    routeType === 1400
  );
}

/** Como as viagens usam o traçado. */
export interface ShapeUsage {
  /** Algum trip de metrô, trem, monotrilho ou bonde usa o traçado. */
  rail: boolean;
  /** route_type do primeiro trip; desempata de qual traçado emprestar. */
  routeType: number;
  /** Primeira parada das viagens, ou null se elas não concordam (não mexe na ponta). */
  firstStop: LatLon | null;
  /** Última parada das viagens, ou null se elas não concordam. */
  lastStop: LatLon | null;
}

export type ShapeRepairKind =
  | 'spike-removed'
  | 'gap-filled'
  | 'start-extended'
  | 'end-extended'
  | 'start-trimmed'
  | 'end-trimmed';

export interface ShapeRepairAction {
  shapeId: string;
  kind: ShapeRepairKind;
  /** Comprimento (m) do braço removido, do salto, da extensão ou da ponta cortada. */
  meters: number;
  /** Traçado de onde veio a geometria; ausente quando a extensão é uma reta. */
  borrowedFrom?: string;
}

export interface ShapeRepairResult {
  shapes: GtfsShape[];
  actions: ShapeRepairAction[];
}

interface Candidate {
  shapeId: string;
  routeType: number;
  points: LatLon[];
  cumulative: number[];
}

interface Borrowed {
  shapeId: string;
  /** Projeções nas duas pontas e pontos do outro traçado entre elas, no sentido from->to. */
  from: LatLon;
  interior: LatLon[];
  to: LatLon;
  length: number;
}

export function repairShapes(
  shapes: readonly GtfsShape[],
  usage: ReadonlyMap<string, ShapeUsage>,
  options: ShapeRepairOptions = DEFAULT_SHAPE_REPAIR_OPTIONS,
): ShapeRepairResult {
  const actions: ShapeRepairAction[] = [];
  const isRail = (shapeId: string) => usage.get(shapeId)?.rail === true;

  // 1. Saltos: os doadores são os traçados originais, para o resultado não depender da
  //    ordem dos shapes no arquivo. Os espinhos ainda estão lá de propósito: o da L3 em
  //    Brás é o único ponto da L3 na plataforma da CPTM, onde começa o salto da L11.
  const donors = candidatesOf(shapes, usage);
  let current = shapes.map((shape) =>
    isRail(shape.shapeId) ? fillGaps(shape, usage, donors, options, actions) : shape,
  );

  // 2. Pontas, com os saltos já preenchidos (a L11 completa serve de doadora para a L12).
  const filledDonors = candidatesOf(current, usage);
  current = current.map((shape) => fixEnds(shape, usage, filledDonors, options, actions));

  // 3. Espinhos por último: pega também os que um empréstimo tenha copiado ou criado na emenda.
  current = current.map((shape) =>
    isRail(shape.shapeId)
      ? { shapeId: shape.shapeId, points: removeSpikes(shape, options, actions) }
      : shape,
  );

  return { shapes: current, actions };
}

function candidatesOf(
  shapes: readonly GtfsShape[],
  usage: ReadonlyMap<string, ShapeUsage>,
): Candidate[] {
  return shapes.flatMap((shape) => {
    const info = usage.get(shape.shapeId);
    if (!info?.rail || shape.points.length < 2) return [];
    return [
      {
        shapeId: shape.shapeId,
        routeType: info.routeType,
        points: shape.points,
        cumulative: cumulativeDistances(shape.points),
      },
    ];
  });
}

/** Remove o vértice onde o traçado dá meia-volta com dois braços longos. */
function removeSpikes(
  shape: GtfsShape,
  options: ShapeRepairOptions,
  actions: ShapeRepairAction[],
): LatLon[] {
  const points = [...shape.points];
  const limit = Math.cos(options.spikeAngleDeg * (Math.PI / 180));
  let i = 1;
  while (i < points.length - 1) {
    const u = vectorMeters(at(points, i - 1), at(points, i));
    const v = vectorMeters(at(points, i), at(points, i + 1));
    const lu = Math.hypot(u.x, u.y);
    const lv = Math.hypot(v.x, v.y);
    const reverses =
      lu > options.spikeArmMeters &&
      lv > options.spikeArmMeters &&
      (u.x * v.x + u.y * v.y) / (lu * lv) < limit;
    if (!reverses) {
      i++;
      continue;
    }
    points.splice(i, 1);
    actions.push({
      shapeId: shape.shapeId,
      kind: 'spike-removed',
      meters: round(Math.min(lu, lv)),
    });
    // A remoção muda o ângulo do vértice anterior: confere de novo.
    i = Math.max(1, i - 1);
  }
  return points;
}

function fillGaps(
  shape: GtfsShape,
  usage: ReadonlyMap<string, ShapeUsage>,
  donors: readonly Candidate[],
  options: ShapeRepairOptions,
  actions: ShapeRepairAction[],
): GtfsShape {
  const points = shape.points;
  if (points.length < 2) return shape;
  const out: LatLon[] = [at(points, 0)];
  for (let i = 1; i < points.length; i++) {
    const a = at(points, i - 1);
    const b = at(points, i);
    const gap = distanceMeters(a, b);
    if (gap > options.gapMeters) {
      const borrowed = borrow(a, b, shape.shapeId, usage, donors, options);
      if (borrowed) {
        out.push(...borrowed.interior);
        actions.push({
          shapeId: shape.shapeId,
          kind: 'gap-filled',
          meters: round(gap),
          borrowedFrom: borrowed.shapeId,
        });
      }
    }
    out.push(b);
  }
  return { shapeId: shape.shapeId, points: out };
}

function fixEnds(
  shape: GtfsShape,
  usage: ReadonlyMap<string, ShapeUsage>,
  donors: readonly Candidate[],
  options: ShapeRepairOptions,
  actions: ShapeRepairAction[],
): GtfsShape {
  const info = usage.get(shape.shapeId);
  if (!info || shape.points.length < 2) return shape;
  let points = shape.points;
  if (info.firstStop) {
    // A ponta inicial é a final do traçado invertido: mesma regra, um código só.
    const reversed = fixTail(
      [...points].reverse(),
      info.firstStop,
      shape.shapeId,
      info.rail,
      usage,
      donors,
      options,
    );
    if (reversed.action) {
      points = reversed.points.reverse();
      actions.push({ ...reversed.action, kind: startKind(reversed.action.kind) });
    }
  }
  if (info.lastStop) {
    const tail = fixTail(points, info.lastStop, shape.shapeId, info.rail, usage, donors, options);
    if (tail.action) {
      points = tail.points;
      actions.push(tail.action);
    }
  }
  return points === shape.points ? shape : { shapeId: shape.shapeId, points };
}

function startKind(kind: ShapeRepairKind): ShapeRepairKind {
  return kind === 'end-extended' ? 'start-extended' : 'start-trimmed';
}

/** Faz o traçado terminar na parada: corta o que passa dela ou emenda o que falta. */
function fixTail(
  points: LatLon[],
  stop: LatLon,
  shapeId: string,
  rail: boolean,
  usage: ReadonlyMap<string, ShapeUsage>,
  donors: readonly Candidate[],
  options: ShapeRepairOptions,
): { points: LatLon[]; action: ShapeRepairAction | null } {
  const end = at(points, points.length - 1);
  if (distanceMeters(end, stop) <= options.endToleranceMeters) return { points, action: null };

  const cumulative = cumulativeDistances(points);
  const lastPass = passesNear(points, stop, options.borrowRadiusMeters, cumulative).at(-1);
  if (lastPass) {
    // O traçado passa pela parada e segue: corta na projeção da parada.
    const beyond = (cumulative.at(-1) ?? 0) - lastPass.along;
    if (beyond <= options.endToleranceMeters) return { points, action: null };
    const kept = points.slice(0, lastPass.segment + 1);
    if (distanceMeters(at(kept, kept.length - 1), lastPass.point) > 1) kept.push(lastPass.point);
    if (kept.length < 2) return { points, action: null };
    return { points: kept, action: { shapeId, kind: 'end-trimmed', meters: round(beyond) } };
  }

  // Não chega à parada: emenda geometria de outro traçado de trilho, senão uma reta.
  const gap = distanceMeters(end, stop);
  const borrowed = rail ? borrow(end, stop, shapeId, usage, donors, options) : null;
  if (borrowed) {
    return {
      points: [...points, ...borrowed.interior, borrowed.to],
      action: { shapeId, kind: 'end-extended', meters: round(gap), borrowedFrom: borrowed.shapeId },
    };
  }
  return {
    points: [...points, stop],
    action: { shapeId, kind: 'end-extended', meters: round(gap) },
  };
}

/**
 * Trecho de outro traçado de trilho que passa a até `borrowRadiusMeters` de `from` e de `to`,
 * no sentido from->to. Prefere o mesmo route_type e, depois, o trecho mais curto.
 */
function borrow(
  from: LatLon,
  to: LatLon,
  ownShapeId: string,
  usage: ReadonlyMap<string, ShapeUsage>,
  donors: readonly Candidate[],
  options: ShapeRepairOptions,
): Borrowed | null {
  const straight = distanceMeters(from, to);
  const ownType = usage.get(ownShapeId)?.routeType;
  let best: { borrowed: Borrowed; rank: number } | null = null;
  for (const donor of donors) {
    if (donor.shapeId === ownShapeId) continue;
    const start = nearestPosition(donor.points, from, donor.cumulative);
    const finish = nearestPosition(donor.points, to, donor.cumulative);
    if (!start || !finish) continue;
    if (start.distance > options.borrowRadiusMeters) continue;
    if (finish.distance > options.borrowRadiusMeters) continue;
    if (start.along === finish.along) continue;

    const forward = start.along < finish.along;
    const interior: LatLon[] = [];
    if (forward) {
      for (let k = start.segment + 1; k <= finish.segment; k++) interior.push(at(donor.points, k));
    } else {
      for (let k = start.segment; k > finish.segment; k--) interior.push(at(donor.points, k));
    }
    // O ponto do doador que coincide com a ponta do salto viraria segmento de 0 m.
    const kept = interior.filter((p) => distanceMeters(p, from) > 1 && distanceMeters(p, to) > 1);
    interior.splice(0, interior.length, ...kept);
    const path = [from, ...interior, to];
    const length = pathLength(path);
    if (length > straight * options.maxDetourRatio) continue;
    // Só vale se o trecho de fato quebra a reta: o sentido oposto da mesma linha
    // costuma ter o mesmo salto e não ajuda.
    if (interior.length === 0 || longestSegment(path) >= straight / 2) continue;

    const rank = (donor.routeType === ownType ? 0 : 1e9) + length;
    if (!best || rank < best.rank) {
      best = {
        borrowed: { shapeId: donor.shapeId, from: start.point, interior, to: finish.point, length },
        rank,
      };
    }
  }
  return best?.borrowed ?? null;
}

function round(meters: number): number {
  return Math.round(meters);
}
