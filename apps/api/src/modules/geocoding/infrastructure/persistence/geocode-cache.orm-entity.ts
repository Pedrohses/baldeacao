import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/** Lugar como guardado no jsonb (mesmo formato do contrato Place). */
export interface CachedPlaceJson {
  id: string;
  name: string;
  address: string | null;
  kind: string;
  location: { lat: number; lon: number };
}

@Entity('geocode_cache')
export class GeocodeCacheOrmEntity {
  /** Consulta normalizada (normalizePlaceQuery). */
  @PrimaryColumn({ name: 'query_key', type: 'text' })
  queryKey: string;

  /** Texto como o usuário digitou na primeira vez (só para inspeção). */
  @Column({ type: 'text' })
  query: string;

  @Column({ type: 'jsonb' })
  places: CachedPlaceJson[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Index('idx_geocode_cache_expires_at')
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}
