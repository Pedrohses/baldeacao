import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Place } from '../../domain/entities/place.entity';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { GeocodeCacheMapper } from './geocode-cache.mapper';

const GET_SQL = `
  SELECT places FROM geocode_cache
  WHERE query_key = $1 AND expires_at > now()`;

// Upsert: a mesma consulta renovada substitui o resultado e o prazo.
const SET_SQL = `
  INSERT INTO geocode_cache (query_key, query, places, created_at, expires_at)
  VALUES ($1, $2, $3::jsonb, now(), now() + make_interval(secs => $4))
  ON CONFLICT (query_key) DO UPDATE
  SET query = EXCLUDED.query, places = EXCLUDED.places,
      created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at`;

/** Cache de geocodificação na tabela geocode_cache (expiração pelo relógio do Postgres). */
@Injectable()
export class TypeormGeocodeCacheRepository extends GeocodeCache {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async get(key: string): Promise<Place[] | null> {
    const rows = await this.dataSource.query<Array<{ places: unknown }>>(GET_SQL, [key]);
    const row = rows[0];
    return row ? GeocodeCacheMapper.toDomain(row.places) : null;
  }

  async set(key: string, query: string, places: Place[], ttlSeconds: number): Promise<void> {
    await this.dataSource.query(SET_SQL, [
      key,
      query,
      JSON.stringify(GeocodeCacheMapper.toJson(places)),
      ttlSeconds,
    ]);
  }
}
