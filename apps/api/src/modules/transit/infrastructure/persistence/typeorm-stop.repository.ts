import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { NearbyStop } from '../../domain/entities/stop.entity';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import type { Coordinates } from '../../domain/value-objects/coordinates';
import { StopMapper, type StopRow } from './transit.mapper';

// ST_DWithin em geography usa o índice GIST de stops.location e mede em metros.
const NEARBY_SQL = `
  WITH center AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
  SELECT s.source_id, s.stop_id, s.code, s.name, s.description,
         ST_Y(s.location::geometry) AS lat, ST_X(s.location::geometry) AS lon,
         ST_Distance(s.location, center.g) AS distance_m
  FROM stops s, center
  WHERE ST_DWithin(s.location, center.g, $3)
  ORDER BY distance_m, s.stop_id
  LIMIT $4`;

@Injectable()
export class TypeormStopRepository extends StopRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findNearby(center: Coordinates, radiusM: number, limit: number): Promise<NearbyStop[]> {
    const rows = await this.dataSource.query<Array<StopRow & { distance_m: number }>>(NEARBY_SQL, [
      center.lon,
      center.lat,
      radiusM,
      limit,
    ]);
    return rows.map((row) => ({
      stop: StopMapper.toDomain(row),
      distanceM: Math.round(Number(row.distance_m)),
    }));
  }
}
