import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('calendar')
export class CalendarOrmEntity {
  @PrimaryColumn({ name: 'source_id', type: 'text' })
  sourceId: string;

  @PrimaryColumn({ name: 'service_id', type: 'text' })
  serviceId: string;

  @Column({ type: 'boolean' })
  monday: boolean;

  @Column({ type: 'boolean' })
  tuesday: boolean;

  @Column({ type: 'boolean' })
  wednesday: boolean;

  @Column({ type: 'boolean' })
  thursday: boolean;

  @Column({ type: 'boolean' })
  friday: boolean;

  @Column({ type: 'boolean' })
  saturday: boolean;

  @Column({ type: 'boolean' })
  sunday: boolean;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;
}
