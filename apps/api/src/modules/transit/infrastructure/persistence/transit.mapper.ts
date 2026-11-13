import { fixDisplayCase } from '../../../../shared/domain/value-objects/display-name';
import { LineShape } from '../../domain/entities/line-shape.entity';
import { Route } from '../../domain/entities/route.entity';
import { Stop } from '../../domain/entities/stop.entity';
import type { Coordinates } from '../../domain/value-objects/coordinates';
import { type DirectionId, routeTypeFromGtfs } from '../../domain/value-objects/route-type';
import type { GeoJsonLineString, GeoJsonPosition } from './geojson.types';
import type { RouteOrmEntity } from './route.orm-entity';

/** Linha crua das consultas SQL de paradas (coordenadas já extraídas com ST_X/ST_Y). */
export interface StopRow {
  source_id: string;
  stop_id: string;
  code: string | null;
  name: string;
  description: string | null;
  lat: number;
  lon: number;
}

export interface LineShapeRow {
  source_id: string;
  route_id: string;
  direction_id: number;
  shape_id: string;
  path: GeoJsonLineString;
}

export const RouteMapper = {
  toDomain(entity: RouteOrmEntity): Route {
    return new Route({
      id: entity.routeId,
      sourceId: entity.sourceId,
      shortName: entity.shortName,
      longName: fixDisplayCase(entity.longName),
      type: routeTypeFromGtfs(entity.routeType),
      color: entity.color?.trim() || null,
      textColor: entity.textColor?.trim() || null,
    });
  },
};

export const StopMapper = {
  toDomain(row: StopRow): Stop {
    return new Stop({
      id: row.stop_id,
      sourceId: row.source_id,
      code: row.code,
      name: fixDisplayCase(row.name),
      description: row.description,
      location: { lat: Number(row.lat), lon: Number(row.lon) },
    });
  },
};

export const LineShapeMapper = {
  toDomain(row: LineShapeRow): LineShape {
    return new LineShape({
      routeId: row.route_id,
      sourceId: row.source_id,
      directionId: (row.direction_id === 1 ? 1 : 0) satisfies DirectionId,
      shapeId: row.shape_id,
      points: row.path.coordinates.map(toCoordinates),
    });
  },
};

function toCoordinates([lon, lat]: GeoJsonPosition): Coordinates {
  return { lat, lon };
}
