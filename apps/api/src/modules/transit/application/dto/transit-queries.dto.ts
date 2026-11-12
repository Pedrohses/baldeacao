import type { LineShape } from '../../domain/entities/line-shape.entity';
import type { Route } from '../../domain/entities/route.entity';
import type { NearbyStop } from '../../domain/entities/stop.entity';
import type { Coordinates } from '../../domain/value-objects/coordinates';

export interface SearchLinesInput {
  text: string;
  /** Padrão 20, máximo 50. */
  limit?: number;
}

export interface SearchLinesOutput {
  lines: Route[];
}

export interface GetLineDetailsInput {
  routeId: string;
}

export interface GetLineDetailsOutput {
  line: Route;
  shapes: LineShape[];
}

export interface FindNearbyStopsInput {
  center: Coordinates;
  /** Padrão 500, máximo 2000. */
  radiusM?: number;
  /** Padrão 50, máximo 200. */
  limit?: number;
}

export interface FindNearbyStopsOutput {
  stops: NearbyStop[];
}
