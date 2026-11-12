import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

/** Limite do município atendido (do recorte OSM), gravado pela importação de lugares. */
@Entity('city_boundaries')
export class CityBoundaryOrmEntity {
  @PrimaryColumn({ type: 'text', primaryKeyConstraintName: 'PK_city_boundaries_name' })
  name: string;

  // geometry e não geography: só serve para ST_Covers de pontos (ver a migração).
  @Index('idx_city_boundaries_area', { spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326 })
  area: GeoJsonMultiPolygon;
}
