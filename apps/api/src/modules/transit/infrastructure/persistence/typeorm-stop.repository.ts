import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { NearbyStop, Stop } from '../../domain/entities/stop.entity';
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

// Índice GIN idx_stops_name_trgm sobre f_unaccent(lower(name)). Estações = paradas servidas por
// rotas de metrô/trem (route_type 1 e 2), calculadas a partir das poucas rotas ferroviárias.
// Com menos de 3 caracteres ($3) só prefixo e início de palavra: o trigrama não ajuda e a varredura custa ~100 ms.
// rank: 0 prefixo do nome, 1 início de palavra, 2 contém, 3 só aproximado (erro de digitação).
const SEARCH_BY_NAME_SQL = `
  WITH q AS (
    SELECT f_unaccent(lower($1)) AS t,
           replace(replace(replace(f_unaccent(lower($1)), '\\', '\\\\'), '%', '\\%'), '_', '\\_') AS lk
  ),
  stations AS (
    SELECT DISTINCT st.source_id, st.stop_id
    FROM routes r
    JOIN trips t ON t.source_id = r.source_id AND t.route_id = r.route_id
    JOIN stop_times st ON st.source_id = t.source_id AND st.trip_id = t.trip_id
    WHERE r.route_type IN (1, 2)
  ),
  cand AS (
    SELECT s.source_id, s.stop_id, s.code, s.name, s.description, s.location,
           f_unaccent(lower(s.name)) AS n,
           (st.stop_id IS NOT NULL) AS is_station
    FROM stops s
    CROSS JOIN q
    LEFT JOIN stations st ON st.source_id = s.source_id AND st.stop_id = s.stop_id
    WHERE f_unaccent(lower(s.name)) LIKE q.lk || '%'
       OR f_unaccent(lower(s.name)) LIKE '% ' || q.lk || '%'
       OR (NOT $3::boolean AND f_unaccent(lower(s.name)) LIKE '%' || q.lk || '%')
       OR (NOT $3::boolean AND q.t <% f_unaccent(lower(s.name)))
  ),
  ranked AS (
    SELECT c.*,
           CASE WHEN c.n LIKE q.lk || '%' THEN 0
                WHEN c.n LIKE '% ' || q.lk || '%' THEN 1
                WHEN c.n LIKE '%' || q.lk || '%' THEN 2
                ELSE 3 END AS rank,
           CASE WHEN c.is_station
                THEN row_number() OVER (PARTITION BY c.n, c.is_station ORDER BY c.stop_id)
                ELSE 1 END AS station_dup
    FROM cand c CROSS JOIN q
  )
  SELECT source_id, stop_id, code, name, description,
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
  FROM ranked
  WHERE station_dup = 1
  ORDER BY is_station DESC, rank, length(name), name, stop_id
  LIMIT $2`;

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

  async searchByName(text: string, limit: number): Promise<Stop[]> {
    const rows = await this.dataSource.query<StopRow[]>(SEARCH_BY_NAME_SQL, [
      text,
      limit,
      text.length < 3,
    ]);
    return rows.map((row) => StopMapper.toDomain(row));
  }
}
