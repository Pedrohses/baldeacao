/** Validade do calendário do GTFS carregado (datas locais AAAA-MM-DD, inclusivas). */
export interface ServicePeriod {
  startDate: string;
  endDate: string;
}

/** Calendário de serviço (calendar.txt) do GTFS importado. */
export abstract class ServiceCalendarRepository {
  /** Do primeiro start_date ao último end_date; null sem GTFS importado. */
  abstract servicePeriod(): Promise<ServicePeriod | null>;
}
