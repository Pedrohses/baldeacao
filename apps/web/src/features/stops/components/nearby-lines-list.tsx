'use client';

import Link from 'next/link';

import { useNow } from '@/shared/hooks/use-now';
import { ArrivalTime } from '@/shared/ui/arrival-time';
import { LineBadge } from '@/shared/ui/line-badge';

import { type NearbyStopsCenter, useNearbyLines } from '../hooks';
import { minutesUntil } from '../utils/arrival-time';

export const NEARBY_LINES_LIMIT = 6;

export interface NearbyLinesListProps {
  /** Posição do usuário ou centro do mapa; null não mostra nada. */
  center: NearbyStopsCenter | null;
  /** Link de cada linha (a página decide a rota). */
  hrefFor: (routeId: string) => string;
  limit?: number;
}

/** Linhas que passam nas paradas perto, com a próxima chegada de cada. */
export function NearbyLinesList({
  center,
  hrefFor,
  limit = NEARBY_LINES_LIMIT,
}: NearbyLinesListProps) {
  const { lines, isPending, isError } = useNearbyLines(center, limit);
  const now = useNow();

  if (!center) return null;
  if (isPending) {
    return (
      <p role="status" className="text-sm text-muted">
        Procurando linhas por perto...
      </p>
    );
  }
  if (isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        Não foi possível carregar as linhas por perto.
      </p>
    );
  }
  if (lines.length === 0) {
    return <p className="text-sm text-muted">Nenhuma linha com chegada prevista aqui perto.</p>;
  }

  return (
    <ul aria-label="Linhas perto" className="-mx-1 divide-y divide-border">
      {lines.map((line) => (
        <li key={`${line.routeId}-${line.next.directionId}`}>
          <Link
            href={hrefFor(line.routeId)}
            className="flex min-h-14 items-center gap-3 rounded-sm px-1 py-2 transition-colors hover:bg-surface-2"
          >
            <LineBadge
              shortName={line.routeShortName}
              color={line.routeColor}
              textColor={line.routeTextColor}
            />
            <span className="min-w-0 flex-1 truncate font-bold">
              {line.headsign ?? 'Destino não informado'}
            </span>
            <ArrivalTime
              size="sm"
              minutes={minutesUntil(line.next.expectedAt, now)}
              isRealtime={line.next.isRealtime}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
