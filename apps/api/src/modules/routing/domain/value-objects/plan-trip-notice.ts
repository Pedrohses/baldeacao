/** Motivo de uma resposta vazia ou limitada do planejador (mesmos códigos do contrato). */
export type PlanTripNotice =
  | 'origin_outside_service_area'
  | 'destination_outside_service_area'
  /** Data pedida fora da validade do calendário do GTFS carregado. */
  | 'date_outside_service'
  /** Hora pedida já tinha passado: a busca foi para o mesmo horário no dia seguinte. */
  | 'time_in_past_moved';

/** Sem parada a até isto da origem ou do destino, o ponto está fora da área atendida. */
export const SERVICE_AREA_RADIUS_M = 1000;
