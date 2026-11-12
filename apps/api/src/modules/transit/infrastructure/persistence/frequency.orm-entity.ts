import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { TripOrmEntity } from './trip.orm-entity';

// Janelas de frequência em segundos desde a meia-noite do dia de serviço.
@Entity('frequencies')
export class FrequencyOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'trip_id', type: 'text' })
  tripId: string;

  @PrimaryColumn({ name: 'start_time', type: 'integer' })
  startTime: number;

  @Column({ name: 'end_time', type: 'integer' })
  endTime: number;

  @Column({ name: 'headway_secs', type: 'integer' })
  headwaySecs: number;

  @ManyToOne(() => TripOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'source_id', referencedColumnName: 'sourceId' },
    { name: 'trip_id', referencedColumnName: 'tripId' },
  ])
  trip?: TripOrmEntity;
}
