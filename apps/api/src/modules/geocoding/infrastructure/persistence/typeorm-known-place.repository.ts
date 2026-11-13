import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Coordinates } from '../../domain/entities/place.entity';
import { SERVICE_CITY_CENTER, SERVICE_CITY_NAME } from '../../domain/value-objects/service-city';
import {
  type KnownPlaceMatch,
  type KnownPlaceRecord,
  KnownPlaceRepository,
  type NearestKnownPlace,
} from '../../domain/ports/known-place-repository.port';
import { ALIASES_SEPARATOR, KnownPlaceMapper, type KnownPlaceRow } from './known-place.mapper';

/** Linhas por INSERT na importação. */
export const KNOWN_PLACES_BATCH_SIZE = 1000;

// Índices GIN idx_places_name_trgm e idx_places_aliases_trgm sobre f_unaccent(lower(...)).
// Com menos de 3 caracteres ($3) só prefixo e início de palavra (o trigrama não ajuda).
// Ordem (a final sai de rankPlaces): 0 nome ou apelido igual, 1 prefixo ou início de palavra,
// 2 contém, 3 só aproximado; depois dentro do município, importância e distância ao centro.
const SEARCH_BY_NAME_SQL = `
  WITH q AS (
    SELECT f_unaccent(lower($1)) AS t,
           replace(replace(replace(f_unaccent(lower($1)), '\\', '\\\\'), '%', '\\%'), '_', '\\_') AS lk,
           ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography AS center
  ),
  cand AS (
    SELECT p.osm_id, p.name, p.kind, p.category, p.aliases, p.in_city, p.address, p.importance,
           p.location, f_unaccent(lower(p.name)) AS n, f_unaccent(lower(p.aliases)) AS a
    FROM places p CROSS JOIN q
    WHERE f_unaccent(lower(p.name)) LIKE q.lk || '%'
       OR f_unaccent(lower(p.name)) LIKE '% ' || q.lk || '%'
       OR f_unaccent(lower(p.aliases)) LIKE q.lk || '%'
       OR f_unaccent(lower(p.aliases)) LIKE '%|' || q.lk || '%'
       OR f_unaccent(lower(p.aliases)) LIKE '% ' || q.lk || '%'
       OR (NOT $3::boolean AND f_unaccent(lower(p.name)) LIKE '%' || q.lk || '%')
       OR (NOT $3::boolean AND q.t <% f_unaccent(lower(p.name)))
       OR (NOT $3::boolean AND q.t <% f_unaccent(lower(p.aliases)))
  )
  SELECT osm_id, name, kind, category, aliases, in_city, address, importance,
         ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lon
  FROM cand CROSS JOIN q
  ORDER BY CASE WHEN n = q.t OR '|' || a || '|' LIKE '%|' || q.lk || '|%' THEN 0
                WHEN n LIKE q.lk || '%' OR n LIKE '% ' || q.lk || '%'
                  OR a LIKE q.lk || '%' OR a LIKE '%|' || q.lk || '%' OR a LIKE '% ' || q.lk || '%'
                  THEN 1
                WHEN n LIKE '%' || q.lk || '%' THEN 2
                ELSE 3 END,
           in_city IS NOT FALSE DESC, importance DESC, ST_Distance(location, q.center),
           length(name), name, osm_id
  LIMIT $2`;

// Cada ponto dentro do limite do município? Sem limite importado, null.
const IN_CITY_SQL = `
  SELECT p.i, CASE WHEN b.area IS NULL THEN NULL
                   ELSE ST_Covers(b.area, ST_SetSRID(ST_MakePoint(p.lon, p.lat), 4326)) END AS inside
  FROM unnest($1::float8[], $2::float8[]) WITH ORDINALITY AS p(lat, lon, i)
  LEFT JOIN city_boundaries b ON b.name = $3
  ORDER BY p.i`;

const INSERT_BOUNDARY_SQL = `
  INSERT INTO city_boundaries (name, area)
  VALUES ($1, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326)), 3)))`;

const NEAREST_SQL = `
  WITH center AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
  SELECT p.osm_id, p.name, p.kind, p.category, p.address, p.importance,
         ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lon,
         ST_Distance(p.location, center.g) AS distance_m
  FROM places p, center
  WHERE ST_DWithin(p.location, center.g, $3)
  ORDER BY distance_m, p.importance DESC, p.osm_id
  LIMIT 1`;

// Área vira centroide; geometria inválida (anel aberto, etc.) é descartada pelo WHERE.
const INSERT_SQL = `
  INSERT INTO places (osm_id, name, category, kind, importance, aliases, address, suburb, city,
                      location)
  SELECT r.osm_id, r.name, r.category, r.kind, r.importance, r.aliases, r.address, r.suburb,
         r.city, ST_Centroid(ST_SetSRID(ST_GeomFromGeoJSON(r.geom), 4326))::geography
  FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::smallint[], $6::text[],
              $7::text[], $8::text[], $9::text[], $10::text[])
       AS r(osm_id, name, category, kind, importance, aliases, address, suburb, city, geom)
  WHERE NOT ST_IsEmpty(ST_GeomFromGeoJSON(r.geom))
  ON CONFLICT (osm_id) DO NOTHING`;

const UPDATE_IN_CITY_SQL = `
  UPDATE places p
  SET in_city = ST_Covers(b.area, p.location::geometry)
  FROM city_boundaries b
  WHERE b.name = $1`;

/** Lugares candidatos pedidos ao banco; a ordem final sai de rankPlaces. */
export const KNOWN_PLACES_POOL_MIN = 40;

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
      SERVICE_CITY_CENTER.lat,
      SERVICE_CITY_CENTER.lon,
    ]);
    return rows.map((row) => ({
      place: KnownPlaceMapper.toDomain(row),
      importance: Number(row.importance),
      category: row.category ?? '',
      aliases: KnownPlaceMapper.aliases(row),
      inCity: row.in_city ?? null,
    }));
  }

  async inServiceCity(points: Coordinates[]): Promise<Array<boolean | null>> {
    if (points.length === 0) return [];
    const rows = await this.dataSource.query<Array<{ inside: boolean | null }>>(IN_CITY_SQL, [
      points.map((p) => p.lat),
      points.map((p) => p.lon),
      SERVICE_CITY_NAME,
    ]);
    return rows.map((row) => row.inside);
  }

  async findNearest(center: Coordinates, radiusM: number): Promise<NearestKnownPlace | null> {
    const rows = await this.dataSource.query<Array<KnownPlaceRow & { distance_m: number }>>(
      NEAREST_SQL,
      [center.lon, center.lat, radiusM],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      place: KnownPlaceMapper.toDomain(row),
      category: row.category ?? '',
      distanceM: Number(row.distance_m),
    };
  }

  async replaceAll(
    records: KnownPlaceRecord[],
    cityBoundaryGeoJson: string | null,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM places');
      await manager.query('DELETE FROM city_boundaries WHERE name = $1', [SERVICE_CITY_NAME]);
      if (cityBoundaryGeoJson) {
        await manager.query(INSERT_BOUNDARY_SQL, [SERVICE_CITY_NAME, cityBoundaryGeoJson]);
      }
      for (let i = 0; i < records.length; i += KNOWN_PLACES_BATCH_SIZE) {
        const batch = records.slice(i, i + KNOWN_PLACES_BATCH_SIZE);
        await manager.query(INSERT_SQL, [
          batch.map((r) => r.id),
          batch.map((r) => r.name),
          batch.map((r) => r.category),
          batch.map((r) => r.kind),
          batch.map((r) => r.importance),
          batch.map((r) => r.aliases.join(ALIASES_SEPARATOR)),
          batch.map((r) => r.address),
          batch.map((r) => r.suburb),
          batch.map((r) => r.city),
          batch.map((r) => r.geometryGeoJson),
        ]);
      }
      await manager.query(UPDATE_IN_CITY_SQL, [SERVICE_CITY_NAME]);
      const [row] = await manager.query<Array<{ total: string }>>(
        'SELECT count(*) AS total FROM places',
      );
      return Number(row?.total ?? 0);
    });
  }
}
