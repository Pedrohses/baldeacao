import { Injectable } from '@nestjs/common';
import { DataSource, type Repository } from 'typeorm';
import type { LineShape } from '../../domain/entities/line-shape.entity';
import type { Route } from '../../domain/entities/route.entity';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import { RouteOrmEntity } from './route.orm-entity';
import { LineShapeMapper, type LineShapeRow, RouteMapper } from './transit.mapper';

// Para cada sentido, o shape usado pelo maior número de viagens (empate: menor shape_id).
const SHAPES_BY_DIRECTION_SQL = `
  WITH ranked AS (
    SELECT DISTINCT ON (t.direction_id) t.direction_id, t.shape_id
    FROM trips t
    WHERE t.source_id = $1 AND t.route_id = $2
      AND t.direction_id IS NOT NULL AND t.shape_id IS NOT NULL
    GROUP BY t.direction_id, t.shape_id
    ORDER BY t.direction_id, count(*) DESC, t.shape_id
  )
  SELECT s.source_id, $2::text AS route_id, r.direction_id, r.shape_id,
         ST_AsGeoJSON(s.path)::json AS path
  FROM ranked r
  JOIN shapes s ON s.source_id = $1 AND s.shape_id = r.shape_id
  ORDER BY r.direction_id`;

@Injectable()
export class TypeormRouteRepository extends RouteRepository {
  private readonly routes: Repository<RouteOrmEntity>;

  constructor(private readonly dataSource: DataSource) {
    super();
    this.routes = dataSource.getRepository(RouteOrmEntity);
  }

  async search(text: string, limit: number): Promise<Route[]> {
    const escaped = text.replace(/[\\%_]/g, (c) => `\\${c}`);
    const rows = await this.routes
      .createQueryBuilder('r')
      .where('(r.short_name ILIKE :contains OR r.long_name ILIKE :contains)')
      .orderBy(
        `CASE WHEN lower(r.short_name) = lower(:exact) THEN 0
              WHEN r.short_name ILIKE :prefix THEN 1
              ELSE 2 END`,
      )
      .addOrderBy('r.short_name')
      .addOrderBy('r.source_id')
      .setParameters({ contains: `%${escaped}%`, prefix: `${escaped}%`, exact: text })
      .limit(limit)
      .getMany();
    return rows.map((row) => RouteMapper.toDomain(row));
  }

  async findById(routeId: string): Promise<Route | null> {
    // route_id é único por fonte; com várias fontes, a ordem por source_id deixa a escolha estável.
    const row = await this.routes.findOne({ where: { routeId }, order: { sourceId: 'ASC' } });
    return row ? RouteMapper.toDomain(row) : null;
  }

  async findShapes(route: Route): Promise<LineShape[]> {
    const rows = await this.dataSource.query<LineShapeRow[]>(SHAPES_BY_DIRECTION_SQL, [
      route.sourceId,
      route.id,
    ]);
    return rows.map((row) => LineShapeMapper.toDomain(row));
  }
}
