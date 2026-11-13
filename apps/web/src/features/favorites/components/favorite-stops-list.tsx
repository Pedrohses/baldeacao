'use client';

import type { Stop } from '@baldeacao/types';
import type { ReactNode } from 'react';

import { CloseIcon } from '@/shared/ui/icons';

import { useFavoriteStops } from '../hooks';

export interface FavoriteStopsListProps {
  /** Conteúdo extra de cada parada (ex.: próximas chegadas); vem da página, que conhece stops. */
  renderStop?: (stop: Stop) => ReactNode;
}

/** Paradas salvas, cada uma com botão para remover. Vazio: não renderiza nada. */
export function FavoriteStopsList({ renderStop }: FavoriteStopsListProps) {
  const { stops, toggle } = useFavoriteStops();
  if (stops.length === 0) return null;
  return (
    <ul aria-label="Paradas favoritas" className="divide-y divide-border">
      {stops.map((stop) => (
        <li key={stop.id} className="py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold">{stop.name}</p>
              {stop.description ? (
                <p className="truncate text-sm text-muted">{stop.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => toggle(stop)}
              aria-label={`Remover ${stop.name} dos favoritos`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-2"
            >
              <CloseIcon />
            </button>
          </div>
          {renderStop?.(stop)}
        </li>
      ))}
    </ul>
  );
}
