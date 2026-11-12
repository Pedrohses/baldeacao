import { Injectable } from '@nestjs/common';
import {
  ServiceCalendarRepository,
  type ServicePeriod,
} from '../../domain/ports/service-calendar.port';

export interface GetServicePeriodOutput {
  /** null quando não há GTFS importado. */
  period: ServicePeriod | null;
}

/** Validade do calendário do GTFS carregado (para avisar data fora dela no planejador). */
@Injectable()
export class GetServicePeriodUseCase {
  constructor(private readonly calendar: ServiceCalendarRepository) {}

  async execute(): Promise<GetServicePeriodOutput> {
    return { period: await this.calendar.servicePeriod() };
  }
}
