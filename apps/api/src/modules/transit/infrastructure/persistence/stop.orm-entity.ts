import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GeoJsonPoint } from './geojson.types';

@Entity('stops')
export class StopOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'stop_id', type: 'text' })
  stopId: string;

  @Column({ type: 'text', nullable: true })
  code: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index('idx_stops_location', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: GeoJsonPoint;
}
