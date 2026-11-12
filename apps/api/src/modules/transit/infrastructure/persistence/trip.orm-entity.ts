import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RouteOrmEntity } from './route.orm-entity';

@Entity('trips')
@Index('idx_trips_route_direction', ['sourceId', 'routeId', 'directionId'])
export class TripOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Column({ name: 'route_id', type: 'text' })
  routeId: string;

  @Column({ name: 'service_id', type: 'text' })
  serviceId: string;

  @Column({ type: 'text', nullable: true })
  headsign: string | null;

  @Column({ name: 'direction_id', type: 'smallint', nullable: true })
  directionId: number | null;

  @Column({ name: 'shape_id', type: 'text', nullable: true })
  shapeId: string | null;

  @ManyToOne(() => RouteOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'source_id', referencedColumnName: 'sourceId' },
    { name: 'route_id', referencedColumnName: 'routeId' },
  ])
  route?: RouteOrmEntity;
}
