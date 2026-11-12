import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Coordinates, Place } from '../../domain/entities/place.entity';
import {
  type KnownPlaceMatch,
  type KnownPlaceRecord,
  KnownPlaceRepository,
} from '../../domain/ports/known-place-repository.port';
import { KnownPlaceMapper, type KnownPlaceRow } from './known-place.mapper';

/** Linhas por INSERT na importação. */
export const KNOWN_PLACES_BATCH_SIZE = 1000;

// Índice GIN idx_places_name_trgm sobre f_unaccent(lower(name)), como em stops.
// Com menos de 3 caracteres ($3) só prefixo e início de palavra (o trigrama não ajuda).
// rank: 0 prefixo do nome, 1 início de palavra, 2 contém, 3 só aproximado (erro de digitação).
const SEARCH_BY_NAME_SQL = `
  WITH q AS (
    SELECT f_unaccent(lower($1)) AS t,
           replace(replace(replace(f_unaccent(lower($1)), '\\', '\\\\'), '%', '\\%'), '_', '\\_') AS lk
  ),
  cand AS (
    SELECT p.osm_id, p.name, p.address, p.importance, p.location,
           f_unaccent(lower(p.name)) AS n
    FROM places p CROSS JOIN q
    WHERE f_unaccent(lower(p.name)) LIKE q.lk || '%'
       OR f_unaccent(lower(p.name)) LIKE '% ' || q.lk || '%'
       OR (NOT $3::boolean AND f_unaccent(lower(p.name)) LIKE '%' || q.lk || '%')
       OR (NOT $3::boolean AND q.t <% f_unaccent(lower(p.name)))
  )
  SELECT osm_id, name, address, importance,
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
  FROM cand CROSS JOIN q
  ORDER BY CASE WHEN n LIKE q.lk || '%' OR n LIKE '% ' || q.lk || '%' THEN 0
                WHEN n LIKE '%' || q.lk || '%' THEN 1
                ELSE 2 END,
           importance DESC, length(name), name, osm_id
  LIMIT $2`;

const NEAREST_SQL = `
  WITH center AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
  SELECT p.osm_id, p.name, p.address, p.importance,
         ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lon,
         ST_Distance(p.location, center.g) AS distance_m
  FROM places p, center
  WHERE ST_DWithin(p.location, center.g, $3)
  ORDER BY distance_m, p.importance DESC, p.osm_id
  LIMIT 1`;

// Área vira centroide; geometria inválida (anel aberto, etc.) é descartada pelo WHERE.
const INSERT_SQL = `
  INSERT INTO places (osm_id, name, category, kind, importance, address, suburb, city, location)
  SELECT r.osm_id, r.name, r.category, 'poi', r.importance, r.address, r.suburb, r.city,
         ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(r.geom), 4326))::geography
  FROM unnest($1::text[], $2::text[], $3::text[], $4::smallint[], $5::text[], $6::text[],
              $7::text[], $8::text[])
       AS r(osm_id, name, category, importance, address, suburb, city, geom)
  WHERE NOT ST_IsEmpty(ST_GeomFromGeoJSON(r.geom))
  ON CONFLICT (osm_id) DO NOTHING`;

/** Lugares conhecidos na tabela `places` (PostGIS + pg_trgm). */
@Injectable()
export class TypeormKnownPlaceRepository extends KnownPlaceRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async searchByName(text: string, limit: number): Promise<KnownPlaceMatch[]> {
    const rows = await this.dataSource.query<KnownPlaceRow[]>(SEARCH_BY_NAME_SQL, [
      text,
      limit,
      text.length < 3,
    ]);
    return rows.map((row) => ({
      place: KnownPlaceMapper.toDomain(row),
      importance: Number(row.importance),
    }));
  }

  async findNearest(
    center: Coordinates,
    radiusM: number,
  ): Promise<{ place: Place; distanceM: number } | null> {
    const rows = await this.dataSource.query<Array<KnownPlaceRow & { distance_m: number }>>(
      NEAREST_SQL,
      [center.lon, center.lat, radiusM],
    );
    const row = rows[0];
    if (!row) return null;
    return { place: KnownPlaceMapper.toDomain(row), distanceM: Number(row.distance_m) };
  }

  async replaceAll(records: KnownPlaceRecord[]): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM places');
      for (let i = 0; i < records.length; i += KNOWN_PLACES_BATCH_SIZE) {
        const batch = records.slice(i, i + KNOWN_PLACES_BATCH_SIZE);
        await manager.query(INSERT_SQL, [
          batch.map((r) => r.id),
          batch.map((r) => r.name),
          batch.map((r) => r.category),
          batch.map((r) => r.importance),
          batch.map((r) => r.address),
          batch.map((r) => r.suburb),
          batch.map((r) => r.city),
          batch.map((r) => r.geometryGeoJson),
        ]);
      }
      const [row] = await manager.query<Array<{ total: string }>>(
        'SELECT count(*) AS total FROM places',
      );
      return Number(row?.total ?? 0);
    });
  }
}
