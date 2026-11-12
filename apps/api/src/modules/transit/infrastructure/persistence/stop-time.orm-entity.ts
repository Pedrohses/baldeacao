import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { StopOrmEntity } from './stop.orm-entity';
import { TripOrmEntity } from './trip.orm-entity';

// Horários em segundos desde a meia-noite do dia de serviço (o GTFS permite passar de 24:00:00).
@Entity('stop_times')
@Index('idx_stop_times_stop', ['sourceId', 'stopId'])
export class StopTimeOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'trip_id', type: 'text' })
  tripId: string;

  @PrimaryColumn({ name: 'stop_sequence', type: 'integer' })
  stopSequence: number;

  @Column({ name: 'stop_id', type: 'text' })
  stopId: string;

  @Column({ name: 'arrival_time', type: 'integer', nullable: true })
  arrivalTime: number | null;

  @Column({ name: 'departure_time', type: 'integer', nullable: true })
  departureTime: number | null;

  @ManyToOne(() => TripOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'source_id', referencedColumnName: 'sourceId' },
    { name: 'trip_id', referencedColumnName: 'tripId' },
  ])
  trip?: TripOrmEntity;

  @ManyToOne(() => StopOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'source_id', referencedColumnName: 'sourceId' },
    { name: 'stop_id', referencedColumnName: 'stopId' },
  ])
  stop?: StopOrmEntity;
}
