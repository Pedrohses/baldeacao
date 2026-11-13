// Geometria plana local para traçados: precisa o bastante na escala de uma cidade
// (mesma aproximação dos scripts de QA) e sem dependência externa.

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_M = 6371000;
const RAD = Math.PI / 180;

export function distanceMeters(a: LatLon, b: LatLon): number {
  const x = (b.lon - a.lon) * RAD * Math.cos(((a.lat + b.lat) / 2) * RAD);
  const y = (b.lat - a.lat) * RAD;
  return Math.hypot(x, y) * EARTH_RADIUS_M;
}

/** Distância acumulada (m) até cada ponto; o primeiro é 0. */
export function cumulativeDistances(points: readonly LatLon[]): number[] {
  const out: number[] = [];
  let total = 0;
  points.forEach((point, i) => {
    const previous = points[i - 1];
    if (previous) total += distanceMeters(previous, point);
    out.push(total);
  });
  return out;
}

export function pathLength(points: readonly LatLon[]): number {
  return cumulativeDistances(points).at(-1) ?? 0;
}

export function longestSegment(points: readonly LatLon[]): number {
  let longest = 0;
  for (let i = 1; i < points.length; i++) {
    longest = Math.max(longest, distanceMeters(at(points, i - 1), at(points, i)));
  }
  return longest;
}

/** Vetor a->b em metros (x para leste, y para norte), no plano local de a. */
export function vectorMeters(a: LatLon, b: LatLon): { x: number; y: number } {
  return {
    x: (b.lon - a.lon) * RAD * Math.cos(a.lat * RAD) * EARTH_RADIUS_M,
    y: (b.lat - a.lat) * RAD * EARTH_RADIUS_M,
  };
}

export interface SegmentProjection {
  /** Fração do segmento (0 a 1) onde cai a projeção. */
  t: number;
  point: LatLon;
  /** Distância (m) do ponto consultado até a projeção. */
  distance: number;
}

export function projectOnSegment(p: LatLon, a: LatLon, b: LatLon): SegmentProjection {
  const va = vectorMeters(p, a);
  const vb = vectorMeters(p, b);
  const dx = vb.x - va.x;
  const dy = vb.y - va.y;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(va.x * dx + va.y * dy) / length2));
  return {
    t,
    point: { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t },
    distance: Math.hypot(va.x + t * dx, va.y + t * dy),
  };
}

/** Posição num traçado: segmento i liga points[i] a points[i + 1]. */
export interface PolylinePosition extends SegmentProjection {
  segment: number;
  /** Distância (m) percorrida desde o início do traçado até a projeção. */
  along: number;
}

/** Projeção de p sobre cada segmento do traçado, em ordem. */
export function projectOnPolyline(
  points: readonly LatLon[],
  p: LatLon,
  cumulative: readonly number[] = cumulativeDistances(points),
): PolylinePosition[] {
  const out: PolylinePosition[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const projection = projectOnSegment(p, at(points, i), at(points, i + 1));
    const start = cumulative[i] ?? 0;
    const end = cumulative[i + 1] ?? start;
    out.push({ ...projection, segment: i, along: start + (end - start) * projection.t });
  }
  return out;
}

/** Ponto do traçado mais próximo de p, ou null se o traçado tem menos de dois pontos. */
export function nearestPosition(
  points: readonly LatLon[],
  p: LatLon,
  cumulative?: readonly number[],
): PolylinePosition | null {
  let best: PolylinePosition | null = null;
  for (const position of projectOnPolyline(points, p, cumulative)) {
    if (!best || position.distance < best.distance) best = position;
  }
  return best;
}

/**
 * Passagens do traçado a até `radius` de p: cada passagem é uma sequência contígua de
 * segmentos dentro do raio, representada pela projeção mais próxima dela.
 */
export function passesNear(
  points: readonly LatLon[],
  p: LatLon,
  radius: number,
  cumulative?: readonly number[],
): PolylinePosition[] {
  const passes: PolylinePosition[] = [];
  let current: PolylinePosition | null = null;
  for (const position of projectOnPolyline(points, p, cumulative)) {
    if (position.distance > radius) {
      if (current) passes.push(current);
      current = null;
    } else if (!current || position.distance < current.distance) {
      current = position;
    }
  }
  if (current) passes.push(current);
  return passes;
}

export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`Índice fora do traçado: ${index}`);
  return item;
}
