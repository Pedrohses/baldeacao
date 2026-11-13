'use client';

import type { Arrival, NearbyStop } from '@baldeacao/types';
import { Fragment } from 'react';

import { useNow } from '@/shared/hooks/use-now';
import { ArrivalTime } from '@/shared/ui/arrival-time';
import { StopSignIcon } from '@/shared/ui/icons';
import { LineBadge } from '@/shared/ui/line-badge';

import { type NearbyStopsCenter, useNearbyStops, useStopArrivals } from '../hooks';
import { minutesUntil } from '../utils/arrival-time';

export const NEARBY_LIST_LIMIT = 4;
/** Quantas linhas (cada uma com as próximas chegadas) mostrar por parada. */
export const NEARBY_LINES_PER_STOP = 2;
/** Chegadas seguintes mostradas ao lado da primeira de cada linha. */
const LATER_ARRIVALS = 2;

export interface NearbyStopsListProps {
  /** Posição do usuário ou centro do mapa; null não consulta. */
  center: NearbyStopsCenter | null;
  onSelectStop: (stop: NearbyStop) => void;
  limit?: number;
  /** Quantas linhas mostrar por parada. */
  linesPerStop?: number;
}

/** Agrupa as chegadas por linha, na ordem da primeira chegada de cada uma. */
export function groupArrivalsByRoute(arrivals: readonly Arrival[]): Arrival[][] {
  const groups = new Map<string, Arrival[]>();
  for (const arrival of arrivals) {
    const group = groups.get(arrival.routeId);
    if (group) group.push(arrival);
    else groups.set(arrival.routeId, [arrival]);
  }
  return [...groups.values()];
}

function NextArrivals({ stopId, now, lines }: { stopId: string; now: Date; lines: number }) {
  const { data, isPending } = useStopArrivals(stopId);
  if (isPending) return null;
  const groups = groupArrivalsByRoute(data ?? []).slice(0, lines);
  if (groups.length === 0) {
    return <span className="shrink-0 text-sm text-muted">Sem previsão agora</span>;
  }
  return (
    // Grade de 3 colunas (selo, primeira chegada, seguintes): tempos alinham entre as linhas.
    <span className="grid shrink-0 grid-cols-[auto_auto_minmax(2.75rem,auto)] items-center gap-x-2 gap-y-1">
      {groups.map((group) => {
        const [first, ...rest] = group as [Arrival, ...Arrival[]];
        const later = rest
          .slice(0, LATER_ARRIVALS)
          .map((arrival) => minutesUntil(arrival.expectedAt, now));
        return (
          <Fragment key={first.routeId}>
            <LineBadge
              size="sm"
              shortName={first.routeShortName}
              color={first.routeColor}
              textColor={first.routeTextColor}
            />
            <ArrivalTime
              size="sm"
              className="justify-end"
              minutes={minutesUntil(first.expectedAt, now)}
              isRealtime={first.isRealtime}
            />
            <span className="text-sm text-muted tabular-nums">
              {later.length > 0 ? (
                <>
                  <span className="sr-only">depois em </span>
                  {later.join(', ')}
                </>
              ) : null}
            </span>
          </Fragment>
        );
      })}
    </span>
  );
}

/**
 * Paradas mais próximas com as próximas chegadas agrupadas por linha (selo e tempos). Também é a
 * alternativa por teclado às paradas do mapa.
 */
export function NearbyStopsList({
  center,
  onSelectStop,
  limit = NEARBY_LIST_LIMIT,
  linesPerStop = NEARBY_LINES_PER_STOP,
}: NearbyStopsListProps) {
  const { data, isPending, isError } = useNearbyStops(center);
  const now = useNow();

  if (!center) return null;
  if (isPending) {
    return (
      <p role="status" className="text-muted">
        Procurando paradas...
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar as paradas por perto.
      </p>
    );
  }
  const stops = [...data].sort((a, b) => a.distanceM - b.distanceM).slice(0, limit);
  if (stops.length === 0) {
    return <p className="text-muted">Nenhuma parada a até 500 m daqui.</p>;
  }

  return (
    <ul className="-mx-2 divide-y divide-border">
      {stops.map((stop) => (
        <li key={stop.id}>
          <button
            type="button"
            onClick={() => onSelectStop(stop)}
            className="flex min-h-14 w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors hover:bg-surface-2"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
              <StopSignIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-bold">{stop.name}</span>
              <span className="block text-sm text-muted">{Math.round(stop.distanceM)} m</span>
            </span>
            <NextArrivals stopId={stop.id} now={now} lines={linesPerStop} />
          </button>
        </li>
      ))}
    </ul>
  );
}
