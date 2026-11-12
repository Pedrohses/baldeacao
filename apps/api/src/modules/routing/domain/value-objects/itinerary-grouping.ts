import type { Itinerary } from '../entities/itinerary.entity';

/** Saídas seguintes guardadas em cada grupo. */
export const ALSO_DEPARTS_MAX = 3;

/**
 * Assinatura dos trechos de transporte: modo e linha em sequência ("subway:L4>bus:746H-10").
 * Itinerário só a pé tem a assinatura própria "walk".
 */
export function itinerarySignature(itinerary: Itinerary): string {
  const transit = itinerary.legs.filter((leg) => leg.mode !== 'walk');
  if (transit.length === 0) return 'walk';
  return transit.map((leg) => `${leg.mode}:${leg.routeId ?? leg.routeShortName ?? '?'}`).join('>');
}

const time = (iso: string): number => Date.parse(iso);

/**
 * Agrupa itinerários com a mesma assinatura: cada grupo vira o de saída mais cedo, com as
 * saídas seguintes (até 3, sem repetir horário) em `alsoDepartsAt`. Devolve até `max`
 * grupos, ordenados pela chegada.
 */
export function groupItineraries(itineraries: Itinerary[], max: number): Itinerary[] {
  const groups = new Map<string, Itinerary[]>();
  for (const itinerary of itineraries) {
    const key = itinerarySignature(itinerary);
    const group = groups.get(key);
    if (group) group.push(itinerary);
    else groups.set(key, [itinerary]);
  }

  const grouped: Itinerary[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => time(a.startAt) - time(b.startAt) || time(a.endAt) - time(b.endAt),
    );
    const first = sorted[0];
    if (!first) continue;
    const seen = new Set<number>([time(first.startAt)]);
    const also: string[] = [];
    for (const next of sorted.slice(1)) {
      if (also.length >= ALSO_DEPARTS_MAX) break;
      if (seen.has(time(next.startAt))) continue;
      seen.add(time(next.startAt));
      also.push(next.startAt);
    }
    const representative: Itinerary = { ...first };
    delete representative.alsoDepartsAt;
    if (also.length > 0) representative.alsoDepartsAt = also;
    grouped.push(representative);
  }

  return grouped
    .sort((a, b) => time(a.endAt) - time(b.endAt) || time(a.startAt) - time(b.startAt))
    .slice(0, Math.max(0, max));
}
