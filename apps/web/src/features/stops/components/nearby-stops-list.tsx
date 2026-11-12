'use client';

import type { NearbyStop } from '@baldeacao/types';

import { useNow } from '@/shared/hooks/use-now';
import { StopSignIcon } from '@/shared/ui/icons';

import { type NearbyStopsCenter, useNearbyStops, useStopArrivals } from '../hooks';
import { formatMinutes, minutesUntil } from '../utils/arrival-time';

export const NEARBY_LIST_LIMIT = 4;
const NEXT_ARRIVALS = 2;

export interface NearbyStopsListProps {
  /** Posição do usuário ou centro do mapa; null não consulta. */
  center: NearbyStopsCenter | null;
  onSelectStop: (stop: NearbyStop) => void;
  limit?: number;
}

function NextArrivals({ stopId, now }: { stopId: string; now: Date }) {
  const { data } = useStopArrivals(stopId);
  const next = (data ?? []).slice(0, NEXT_ARRIVALS);
  if (next.length === 0) return null;
  return (
    <span className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
      {next.map((arrival, index) => (
        <span key={`${arrival.routeId}-${index}`} className="inline-flex items-center gap-1.5">
          <span className="font-mono font-bold">{arrival.routeShortName}</span>
          <span className={`font-mono ${arrival.isRealtime ? 'text-live' : 'text-muted'}`}>
            {formatMinutes(minutesUntil(arrival.expectedAt, now))}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Paradas mais próximas com as 2 próximas chegadas de cada. Também é a alternativa por teclado
 * às paradas do mapa.
 */
export function NearbyStopsList({
  center,
  onSelectStop,
  limit = NEARBY_LIST_LIMIT,
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
    <ul className="-mx-2">
      {stops.map((stop) => (
        <li key={stop.id}>
          <button
            type="button"
            onClick={() => onSelectStop(stop)}
            className="flex min-h-14 w-full items-center gap-3 rounded-sm px-2 py-2 text-left hover:bg-surface-2"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
              <StopSignIcon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{stop.name}</span>
              <span className="block text-sm text-muted">{Math.round(stop.distanceM)} m</span>
            </span>
            <NextArrivals stopId={stop.id} now={now} />
          </button>
        </li>
      ))}
    </ul>
  );
}
