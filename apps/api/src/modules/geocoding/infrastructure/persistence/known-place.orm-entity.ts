import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

/**
 * Lugar conhecido do OSM (importado do recorte .osm.pbf). O índice de trigramas do nome
 * (idx_places_name_trgm) é de expressão e fica só na migração.
 */
@Entity('places')
export class KnownPlaceOrmEntity {
  /** Mesmo formato do id do Nominatim: "osm:way:123". */
  @PrimaryColumn({ name: 'osm_id', type: 'text', primaryKeyConstraintName: 'PK_places_osm_id' })
  osmId: string;

  @Column({ type: 'text' })
  name: string;

  /** Tag OSM que classificou o lugar, ex.: "leisure=park". */
  @Column({ type: 'text' })
  category: string;

  @Column({ type: 'text', default: 'poi' })
  kind: string;

  /** Maior = aparece antes na busca (ver osm-poi-category). */
  @Column({ type: 'smallint', default: 0 })
  importance: number;

  /** Nomes alternativos separados por "|" (índice de trigramas só na migração). */
  @Column({ type: 'text', default: '' })
  aliases: string;

  /** Dentro do município atendido; null sem limite importado. */
  @Column({ name: 'in_city', type: 'boolean', nullable: true })
  inCity: boolean | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'text', nullable: true })
  suburb: string | null;

  @Column({ type: 'text', nullable: true })
  city: string | null;

  @Index('idx_places_location', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: GeoJsonPoint;
}
