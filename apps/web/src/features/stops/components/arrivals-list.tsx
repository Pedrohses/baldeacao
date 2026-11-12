'use client';

import type { Arrival } from '@baldeacao/types';

import { useNow, useStopArrivals } from '../hooks';
import { formatMinutes, minutesUntil } from '../utils/arrival-time';

export interface ArrivalsListViewProps {
  arrivals: readonly Arrival[];
  now: Date;
}

/** Apresentação pura: lista de previsões com minutos e origem (tempo real ou tabela). */
export function ArrivalsListView({ arrivals, now }: ArrivalsListViewProps) {
  if (arrivals.length === 0) {
    return <p className="text-sm text-neutral-600">Nenhuma chegada prevista no momento.</p>;
  }
  return (
    <ul className="divide-y divide-neutral-200" aria-label="Próximas chegadas">
      {arrivals.map((arrival, index) => {
        const minutes = minutesUntil(arrival.expectedAt, now);
        return (
          <li
            key={`${arrival.routeId}-${arrival.directionId}-${index}`}
            className="flex items-center justify-between gap-3 py-2"
          >
            <div className="min-w-0">
              <p className="font-semibold">{arrival.routeShortName}</p>
              {arrival.headsign ? (
                <p className="truncate text-sm text-neutral-600">{arrival.headsign}</p>
              ) : null}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums">{formatMinutes(minutes)}</p>
              <p
                className={arrival.isRealtime ? 'text-xs text-green-800' : 'text-xs text-neutral-600'}
              >
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
      <p role="status" className="text-sm text-neutral-600">
        Carregando previsões...
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Não foi possível carregar as previsões desta parada.
      </p>
    );
  }
  return <ArrivalsListView arrivals={data} now={now} />;
}
