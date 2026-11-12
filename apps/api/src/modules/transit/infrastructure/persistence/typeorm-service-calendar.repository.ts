import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ServiceCalendarRepository,
  type ServicePeriod,
} from '../../domain/ports/service-calendar.port';

const PERIOD_SQL = `
  SELECT to_char(min(start_date), 'YYYY-MM-DD') AS start_date,
         to_char(max(end_date), 'YYYY-MM-DD') AS end_date
  FROM calendar`;

/** Validade do calendário na tabela `calendar`. */
@Injectable()
export class TypeormServiceCalendarRepository extends ServiceCalendarRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async servicePeriod(): Promise<ServicePeriod | null> {
    const [row] =
      await this.dataSource.query<Array<{ start_date: string | null; end_date: string | null }>>(
        PERIOD_SQL,
      );
    if (!row?.start_date || !row.end_date) return null;
    return { startDate: row.start_date, endDate: row.end_date };
  }
}
