import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { GeoJsonLineString } from './geojson.types';

// Um registro por shape_id: os pontos do shapes.txt viram um LineString na ordem da sequência.
@Entity('shapes')
export class ShapeOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'shape_id', type: 'text' })
  shapeId: string;

  @Index('idx_shapes_path', { spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'LineString', srid: 4326 })
  path: GeoJsonLineString;
}
