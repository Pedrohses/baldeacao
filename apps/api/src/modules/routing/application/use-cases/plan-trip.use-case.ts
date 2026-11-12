import { Injectable } from '@nestjs/common';
import { GetServicePeriodUseCase } from '../../../transit/application/use-cases/get-service-period.use-case';
import { HasNearbyStopUseCase } from '../../../transit/application/use-cases/has-nearby-stop.use-case';
import type { Coordinates } from '../../domain/entities/itinerary.entity';
import { InvalidTripRequestError } from '../../domain/errors/invalid-trip-request.error';
import { Clock } from '../../domain/ports/clock.port';
import { TripPlanner } from '../../domain/ports/trip-planner.port';
import { groupItineraries } from '../../domain/value-objects/itinerary-grouping';
import {
  type PlanTripNotice,
  SERVICE_AREA_RADIUS_M,
} from '../../domain/value-objects/plan-trip-notice';
import { movePastTimeForward, serviceDateOf } from '../../domain/value-objects/trip-date';
import type { TripTime } from '../../domain/value-objects/trip-plan-query';
import type { PlanTripInput, PlanTripOutput } from '../dto/plan-trip.dto';

export const PLAN_TRIP_DEFAULT_ITINERARIES = 3;
export const PLAN_TRIP_MAX_ITINERARIES = 5;
/** Mínimo de itinerários pedidos ao planejador para agrupar as saídas repetidas. */
export const PLAN_TRIP_MIN_CANDIDATES = 12;

/** Candidatos pedidos ao planejador: 12, ou 4 por opção pedida (20 para 5). */
export function planTripCandidates(maxItineraries: number): number {
  return Math.max(PLAN_TRIP_MIN_CANDIDATES, maxItineraries * 4);
}

// ISO 8601 com data, hora e fuso obrigatório (Z ou ±hh:mm).
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function assertCoordinates(point: Coordinates, label: string): void {
  const ok =
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lon) <= 180;
  if (!ok) throw new InvalidTripRequestError(`Coordenada de ${label} inválida.`);
}

function assertDateTime(value: string, label: string): void {
  if (!ISO_WITH_OFFSET.test(value) || Number.isNaN(Date.parse(value))) {
    throw new InvalidTripRequestError(
      `Hora de ${label} inválida: use ISO 8601 com fuso, ex.: 2026-11-12T08:00:00-03:00.`,
    );
  }
}

/**
 * Planeja viagem de A até B em transporte público e caminhada. Sem hora, parte agora.
 * Itinerários com as mesmas linhas viram uma opção só, com as saídas seguintes em alsoDepartsAt.
 */
@Injectable()
export class PlanTripUseCase {
  constructor(
    private readonly planner: TripPlanner,
    private readonly hasNearbyStop: HasNearbyStopUseCase,
    private readonly servicePeriod: GetServicePeriodUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(input: PlanTripInput): Promise<PlanTripOutput> {
    assertCoordinates(input.from, 'origem');
    assertCoordinates(input.to, 'destino');
    if (input.departAt && input.arriveBy) {
      throw new InvalidTripRequestError('Informe só a hora de saída ou só a de chegada.');
    }

    const now = this.clock.now();
    const timeNotices: PlanTripNotice[] = [];
    // Hora que já passou vai para o mesmo horário no dia seguinte, com aviso.
    const forward = (iso: string): string => {
      const moved = movePastTimeForward(iso, now);
      if (!moved) return iso;
      timeNotices.push('time_in_past_moved');
      return moved;
    };
    let time: TripTime = null;
    if (input.departAt) {
      assertDateTime(input.departAt, 'saída');
      time = { departAt: forward(input.departAt) };
    } else if (input.arriveBy) {
      assertDateTime(input.arriveBy, 'chegada');
      time = { arriveBy: forward(input.arriveBy) };
    }
    const requestedIso = time ? ('departAt' in time ? time.departAt : time.arriveBy) : null;

    const requested = Math.trunc(input.maxItineraries ?? PLAN_TRIP_DEFAULT_ITINERARIES);
    const maxItineraries = Math.min(Math.max(1, requested), PLAN_TRIP_MAX_ITINERARIES);

    // Antes do OTP: sem parada a 1 km, avisa (o OTP ainda pode achar rota longa a pé).
    const [areaNotices, dateNotices] = await Promise.all([
      this.serviceAreaNotices(input.from, input.to),
      this.serviceDateNotices(serviceDateOf(requestedIso, now)),
    ]);
    const notices = [...timeNotices, ...dateNotices, ...areaNotices];
    const itineraries = await this.planner.plan({
      from: input.from,
      to: input.to,
      time,
      maxItineraries,
      candidates: planTripCandidates(maxItineraries),
    });
    return { itineraries: groupItineraries(itineraries, maxItineraries), notices };
  }

  /** Data fora da validade do GTFS: o OTP não acha viagens nela (ou acha só caminhada). */
  private async serviceDateNotices(date: string): Promise<PlanTripNotice[]> {
    const { period } = await this.servicePeriod.execute();
    if (!period) return [];
    return date < period.startDate || date > period.endDate ? ['date_outside_service'] : [];
  }

  private async serviceAreaNotices(from: Coordinates, to: Coordinates): Promise<PlanTripNotice[]> {
    const [origin, destination] = await Promise.all([
      this.hasNearbyStop.execute({ center: from, radiusM: SERVICE_AREA_RADIUS_M }),
      this.hasNearbyStop.execute({ center: to, radiusM: SERVICE_AREA_RADIUS_M }),
    ]);
    const notices: PlanTripNotice[] = [];
    if (!origin.hasStop) notices.push('origin_outside_service_area');
    if (!destination.hasStop) notices.push('destination_outside_service_area');
    return notices;
  }
}
