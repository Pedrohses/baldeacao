import type { LineShape } from '../entities/line-shape.entity';
import type { Route } from '../entities/route.entity';

export abstract class RouteRepository {
  /**
   * Linhas cujo letreiro ou nome contém `text` (sem diferenciar maiúsculas), com letreiro
   * exato primeiro, depois letreiro que começa com o texto, depois o resto.
   */
  abstract search(text: string, limit: number): Promise<Route[]>;

  /** Linha pelo route_id do GTFS; null quando não existe. */
  abstract findById(routeId: string): Promise<Route | null>;

  /** O traçado mais usado de cada sentido da linha, em ordem de sentido. */
  abstract findShapes(route: Route): Promise<LineShape[]>;
}
