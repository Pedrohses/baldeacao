import { Injectable } from '@nestjs/common';
import type { Coordinates } from '../../domain/entities/itinerary.entity';
import { InvalidTripRequestError } from '../../domain/errors/invalid-trip-request.error';
import { TripPlanner } from '../../domain/ports/trip-planner.port';
import { groupItineraries } from '../../domain/value-objects/itinerary-grouping';
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
  constructor(private readonly planner: TripPlanner) {}

  async execute(input: PlanTripInput): Promise<PlanTripOutput> {
    assertCoordinates(input.from, 'origem');
    assertCoordinates(input.to, 'destino');
    if (input.departAt && input.arriveBy) {
      throw new InvalidTripRequestError('Informe só a hora de saída ou só a de chegada.');
    }

    let time: TripTime = null;
    if (input.departAt) {
      assertDateTime(input.departAt, 'saída');
      time = { departAt: input.departAt };
    } else if (input.arriveBy) {
      assertDateTime(input.arriveBy, 'chegada');
      time = { arriveBy: input.arriveBy };
    }

    const requested = Math.trunc(input.maxItineraries ?? PLAN_TRIP_DEFAULT_ITINERARIES);
    const maxItineraries = Math.min(Math.max(1, requested), PLAN_TRIP_MAX_ITINERARIES);

    const itineraries = await this.planner.plan({
      from: input.from,
      to: input.to,
      time,
      maxItineraries,
      candidates: planTripCandidates(maxItineraries),
    });
    return { itineraries: groupItineraries(itineraries, maxItineraries) };
  }
}
