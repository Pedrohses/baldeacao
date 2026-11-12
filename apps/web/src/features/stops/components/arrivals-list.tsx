'use client';

import type { Arrival } from '@baldeacao/types';

import { useNow } from '@/shared/hooks/use-now';

import { useStopArrivals } from '../hooks';
import { formatMinutes, minutesUntil } from '../utils/arrival-time';

export interface ArrivalsListViewProps {
  arrivals: readonly Arrival[];
  now: Date;
}

/** Apresentação pura: lista de previsões com minutos e origem (tempo real ou tabela). */
export function ArrivalsListView({ arrivals, now }: ArrivalsListViewProps) {
  if (arrivals.length === 0) {
    return <p className="text-muted">Nenhuma chegada prevista no momento.</p>;
  }
  return (
    <ul className="divide-y divide-border" aria-label="Próximas chegadas">
      {arrivals.map((arrival, index) => {
        const minutes = minutesUntil(arrival.expectedAt, now);
        return (
          <li
            key={`${arrival.routeId}-${arrival.directionId}-${index}`}
            className="flex min-h-14 items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <p className="inline-flex rounded-[6px] bg-surface-2 px-1.5 font-mono font-bold">
                {arrival.routeShortName}
              </p>
              {arrival.headsign ? (
                <p className="truncate text-sm text-muted">{arrival.headsign}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-xl font-bold">{formatMinutes(minutes)}</p>
              <p
                className={`inline-flex items-center gap-1 text-xs ${arrival.isRealtime ? 'font-bold text-live' : 'text-muted'}`}
              >
                {arrival.isRealtime ? (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-live" />
                ) : null}
                {arrival.isRealtime ? 'Tempo real' : 'Tabela'}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface ArrivalsListProps {
  stopId: string;
}

/** Busca e mostra as chegadas de uma parada. */
export function ArrivalsList({ stopId }: ArrivalsListProps) {
  const { data, isPending, isError } = useStopArrivals(stopId);
  const now = useNow();

  if (isPending) {
    return (
      <p role="status" className="text-muted">
        Carregando previsões...
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar as previsões desta parada.
      </p>
    );
  }
  return <ArrivalsListView arrivals={data} now={now} />;
}
