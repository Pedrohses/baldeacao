'use client';

import type { Itinerary } from '@baldeacao/types';

import { ItineraryCard } from './itinerary-card';

export type ItineraryListStatus = 'idle' | 'loading' | 'error' | 'success';

export interface ItineraryListProps {
  status: ItineraryListStatus;
  itineraries: readonly Itinerary[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  now: Date;
  /** Mensagem do erro (ex.: ApiError.message); sem ela usa uma genérica. */
  errorMessage?: string;
  onRetry?: () => void;
  onChangeTime?: () => void;
  onSwap?: () => void;
}

const SECONDARY_BUTTON = 'h-11 rounded-sm border border-border px-4 text-sm font-bold';

function Skeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse rounded-md border-2 border-border p-3">
      <div className="flex justify-between">
        <div className="h-6 w-36 rounded-sm bg-surface-2" />
        <div className="h-6 w-16 rounded-sm bg-surface-2" />
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-surface-2" />
      <div className="mt-3 h-6 w-32 rounded-sm bg-surface-2" />
      <div className="mt-2 h-4 w-48 rounded-sm bg-surface-2" />
    </div>
  );
}

/** Opções de itinerário: esqueletos ao carregar, estados vazio e de erro, cartões ao terminar. */
export function ItineraryList({
  status,
  itineraries,
  selectedIndex,
  onSelect,
  now,
  errorMessage,
  onRetry,
  onChangeTime,
  onSwap,
}: ItineraryListProps) {
  if (status === 'idle') return null;
  if (status === 'loading') {
    return (
      <div className="space-y-2">
        <p role="status" className="sr-only">
          Procurando itinerários...
        </p>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" className="space-y-2">
        <p className="text-danger">
          {errorMessage ?? 'Não foi possível planejar a viagem. Tente de novo.'}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className={SECONDARY_BUTTON}>
            Tentar de novo
          </button>
        ) : null}
      </div>
    );
  }
  if (itineraries.length === 0) {
    return (
      <div className="space-y-2">
        <p role="status">Nenhuma rota de transporte para esse trajeto agora.</p>
        <div className="flex gap-2">
          {onChangeTime ? (
            <button type="button" onClick={onChangeTime} className={SECONDARY_BUTTON}>
              Mudar horário
            </button>
          ) : null}
          {onSwap ? (
            <button type="button" onClick={onSwap} className={SECONDARY_BUTTON}>
              Inverter
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="itineraries-title">
      <h2 id="itineraries-title" className="sr-only">
        Itinerários
      </h2>
      <ul className="space-y-2">
        {itineraries.map((itinerary, index) => (
          <li key={`${itinerary.startAt}-${index}`}>
            <ItineraryCard
              itinerary={itinerary}
              selected={index === selectedIndex}
              onSelect={() => onSelect(index)}
              now={now}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
