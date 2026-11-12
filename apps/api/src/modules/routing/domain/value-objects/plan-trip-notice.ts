/** Motivo de uma resposta vazia ou limitada do planejador (mesmos códigos do contrato). */
export type PlanTripNotice = 'origin_outside_service_area' | 'destination_outside_service_area';

/** Sem parada a até isto da origem ou do destino, o ponto está fora da área atendida. */
export const SERVICE_AREA_RADIUS_M = 1000;
