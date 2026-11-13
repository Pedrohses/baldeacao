import type { Itinerary, TripMode } from '../entities/itinerary.entity';

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

/** Em "chegar até", opção que chega mais que isto antes da mais tardia sai da lista. */
export const ARRIVE_BY_MAX_EARLY_MS = 30 * 60_000;

export interface GroupOptions {
  /** Pedido "chegar até": ordena pela chegada mais tardia (perto do limite). */
  arriveBy?: boolean;
}

/**
 * Desce e sobe na mesma linha em sequência (ex.: 3721-41 num sentido e depois no outro): conta
 * baldeação à toa e costuma ser volta no terminal.
 */
export function hasSameLineTransfer(itinerary: Itinerary): boolean {
  const transit = itinerary.legs.filter((leg) => leg.mode !== 'walk');
  return transit.some((leg, i) => {
    const next = transit[i + 1];
    return next !== undefined && leg.routeId !== null && leg.routeId === next.routeId;
  });
}

const MINUTE_MS = 60_000;
/** Peso da caminhada (min por km) e de cada baldeação (min) na ordem das opções. */
const WALK_MIN_PER_KM = 8;
const TRANSFER_MIN = 3;
/** Fração do tempo de viagem somada à chegada: entre chegadas iguais, a viagem mais curta vence. */
const DURATION_WEIGHT = 0.3;

/**
 * Custo para ordenar as opções de "sair agora/às": chegada (min) mais parte do tempo de viagem,
 * caminhada e baldeações. Ex.: 2105-10 + L12 + L13 (sai 06:38, 1,7 km a pé, 2 baldeações) perde
 * para L1 + L11 + L12 + L13 (sai 06:55, 679 m, 3 baldeações) com a mesma chegada 07:56.
 */
export function rankCost(it: Itinerary): number {
  return (
    time(it.endAt) / MINUTE_MS +
    DURATION_WEIGHT * (it.durationS / 60) +
    WALK_MIN_PER_KM * (it.walkDistanceM / 1000) +
    TRANSFER_MIN * it.transfers
  );
}

/**
 * `a` é dominado por `b`: sai mais cedo ou junto, chega mais tarde ou junto, com baldeações e
 * caminhada iguais ou maiores, e pior em pelo menos um desses quatro pontos.
 */
export function isDominated(a: Itinerary, b: Itinerary): boolean {
  const notBetter =
    time(a.startAt) <= time(b.startAt) &&
    time(a.endAt) >= time(b.endAt) &&
    a.transfers >= b.transfers &&
    a.walkDistanceM >= b.walkDistanceM;
  const worse =
    time(a.startAt) < time(b.startAt) ||
    time(a.endAt) > time(b.endAt) ||
    a.transfers > b.transfers ||
    a.walkDistanceM > b.walkDistanceM;
  return notBetter && worse;
}

/**
 * Agrupa itinerários com a mesma assinatura: cada grupo vira o de saída mais cedo, com as
 * saídas seguintes (até 3, sem repetir horário) em `alsoDepartsAt`. Antes, descarta quem troca
 * para a mesma linha (se houver outra opção); depois, os dominados por outro grupo. Saída
 * (ou agora): ordem por `rankCost` (chegada, tempo de viagem, caminhada e baldeações). Chegar até: chegada mais tardia primeiro,
 * sem as que chegam mais de 30 min antes dela. Devolve até `max` grupos.
 */
export function groupItineraries(
  itineraries: Itinerary[],
  max: number,
  options: GroupOptions = {},
): Itinerary[] {
  const clean = itineraries.filter((it) => !hasSameLineTransfer(it));
  const usable = clean.length > 0 ? clean : itineraries;

  const groups = new Map<string, Itinerary[]>();
  for (const itinerary of usable) {
    const key = itinerarySignature(itinerary);
    const group = groups.get(key);
    if (group) group.push(itinerary);
    else groups.set(key, [itinerary]);
  }

  const grouped: Itinerary[] = [];
  for (const group of groups.values()) {
    // Saída: o representante chega mais cedo e, entre os que chegam juntos, sai mais tarde
    // (não faz a pessoa sair antes para esperar o mesmo trem). Chegar até: a última saída
    // que ainda chega no limite.
    const sorted = [...group].sort(
      (a, b) => time(a.endAt) - time(b.endAt) || time(b.startAt) - time(a.startAt),
    );
    const ordered = options.arriveBy
      ? [...group].sort((a, b) => time(b.startAt) - time(a.startAt))
      : sorted;
    const first = ordered[0];
    if (!first) continue;
    const seen = new Set<number>([time(first.startAt)]);
    const also: string[] = [];
    for (const next of ordered.slice(1)) {
      if (also.length >= ALSO_DEPARTS_MAX) break;
      if (seen.has(time(next.startAt))) continue;
      seen.add(time(next.startAt));
      also.push(next.startAt);
    }
    const representative: Itinerary = { ...first };
    delete representative.alsoDepartsAt;
    if (also.length > 0) {
      representative.alsoDepartsAt = also.sort((a, b) => time(a) - time(b));
    }
    grouped.push(representative);
  }

  let kept = grouped.filter(
    (it) => !grouped.some((other) => other !== it && isDominated(it, other)),
  );
  if (options.arriveBy) {
    const latest = Math.max(...kept.map((it) => time(it.endAt)));
    kept = kept
      .filter((it) => latest - time(it.endAt) <= ARRIVE_BY_MAX_EARLY_MS)
      .sort(
        (a, b) =>
          time(b.endAt) - time(a.endAt) ||
          a.transfers - b.transfers ||
          time(b.startAt) - time(a.startAt),
      );
  } else {
    kept.sort((a, b) => rankCost(a) - rankCost(b) || time(a.endAt) - time(b.endAt));
  }
  return kept.slice(0, Math.max(0, max));
}

/** Alternativa sem o modo dominante só entra se durar até isto vezes a melhor opção. */
export const ALTERNATIVE_MAX_DURATION_RATIO = 1.5;

/**
 * Modos a excluir para buscar uma alternativa ao itinerário: a família do modo com mais tempo
 * de veículo (metrô e trem juntos; ônibus e trólebus juntos). null quando é só caminhada.
 */
export function dominantModeFamily(itinerary: Itinerary): TripMode[] | null {
  const seconds = new Map<TripMode, number>();
  for (const leg of itinerary.legs) {
    if (leg.mode === 'walk') continue;
    seconds.set(leg.mode, (seconds.get(leg.mode) ?? 0) + leg.durationS);
  }
  let dominant: TripMode | null = null;
  for (const [mode, total] of seconds) {
    if (dominant === null || total > (seconds.get(dominant) ?? 0)) dominant = mode;
  }
  if (dominant === null) return null;
  if (dominant === 'subway' || dominant === 'rail') return ['subway', 'rail'];
  if (dominant === 'bus' || dominant === 'trolleybus') return ['bus', 'trolleybus'];
  return [dominant];
}

/**
 * A melhor alternativa (menor duração) de assinatura diferente de `best`, se durar até 1,5x
 * a duração dele; senão null.
 */
export function pickAlternative(best: Itinerary, candidates: Itinerary[]): Itinerary | null {
  const signature = itinerarySignature(best);
  const limit = best.durationS * ALTERNATIVE_MAX_DURATION_RATIO;
  const options = groupItineraries(candidates, Number.MAX_SAFE_INTEGER)
    .filter((it) => itinerarySignature(it) !== signature && it.durationS <= limit)
    .sort((a, b) => a.durationS - b.durationS || time(a.endAt) - time(b.endAt));
  return options[0] ?? null;
}
