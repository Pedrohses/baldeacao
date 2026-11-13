'use client';

import type { Arrival } from '@baldeacao/types';

import { useNow } from '@/shared/hooks/use-now';
import { ArrivalTime } from '@/shared/ui/arrival-time';
import { LineBadge } from '@/shared/ui/line-badge';

import { useStopArrivals } from '../hooks';
import { minutesUntil } from '../utils/arrival-time';

export interface ArrivalsListViewProps {
  arrivals: readonly Arrival[];
  now: Date;
}

/**
 * Apresentação pura no padrão de quadro de partidas: selo da linha na cor do GTFS, destino em uma
 * linha e o tempo grande à direita (ponto verde para tempo real, relógio para tabela).
 */
export function ArrivalsListView({ arrivals, now }: ArrivalsListViewProps) {
  if (arrivals.length === 0) {
    return <p className="text-muted">Nenhuma chegada prevista no momento.</p>;
  }
  return (
    <ul className="divide-y divide-border" aria-label="Próximas chegadas">
      {arrivals.map((arrival, index) => (
        <li
          key={`${arrival.routeId}-${arrival.directionId}-${index}`}
          className="flex min-h-14 items-center gap-3 py-2"
        >
          <LineBadge
            shortName={arrival.routeShortName}
            color={arrival.routeColor}
            textColor={arrival.routeTextColor}
          />
          <p className="min-w-0 flex-1 truncate font-bold">
            {arrival.headsign ?? (
              <span className="font-normal text-muted">Destino não informado</span>
            )}
          </p>
          <ArrivalTime
            minutes={minutesUntil(arrival.expectedAt, now)}
            isRealtime={arrival.isRealtime}
          />
        </li>
      ))}
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
