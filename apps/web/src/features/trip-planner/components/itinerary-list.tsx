'use client';

import type { Itinerary, Leg } from '@baldeacao/types';

import {
  MODE_LABELS,
  formatDistance,
  formatDuration,
  formatTime,
  formatTransfers,
  legColor,
  readableTextColor,
} from '../utils/format';
import { ModeIcon } from './mode-icon';

export type ItineraryListStatus = 'idle' | 'loading' | 'error' | 'success';

export interface ItineraryListProps {
  status: ItineraryListStatus;
  itineraries: readonly Itinerary[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Mensagem do erro (ex.: ApiError.message); sem ela usa uma genérica. */
  errorMessage?: string;
}

function LegChip({ leg }: { leg: Leg }) {
  const duration = formatDuration(leg.durationS);
  if (leg.mode === 'walk') {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-neutral-700">
        <ModeIcon mode="walk" />
        <span className="sr-only">{MODE_LABELS.walk}</span>
        {duration}
      </span>
    );
  }
  const background = legColor(leg);
  return (
    <span
      data-testid="leg-badge"
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-semibold"
      style={{ backgroundColor: background, color: readableTextColor(background) }}
    >
      <ModeIcon mode={leg.mode} />
      <span className="sr-only">{MODE_LABELS[leg.mode]}</span>
      {leg.routeShortName ?? MODE_LABELS[leg.mode]}
    </span>
  );
}

function LegDetail({ leg }: { leg: Leg }) {
  if (leg.mode === 'walk') {
    return (
      <>
        <p className="font-medium">
          Caminhe {formatDistance(leg.distanceM)} até {leg.to.name}
        </p>
        <p className="text-neutral-600">{formatDuration(leg.durationS)}</p>
      </>
    );
  }
  return (
    <>
      <p className="font-medium">
        {MODE_LABELS[leg.mode]} {leg.routeShortName ?? ''}
        {leg.headsign ? ` sentido ${leg.headsign}` : ''}
      </p>
      <p className="text-neutral-600">
        De {leg.from.name} até {leg.to.name}
      </p>
      <p className="text-neutral-600">
        {formatTime(leg.startAt)} até {formatTime(leg.endAt)}, {formatDuration(leg.durationS)}
        {leg.intermediateStops > 0
          ? `, ${leg.intermediateStops} ${leg.intermediateStops === 1 ? 'parada' : 'paradas'}`
          : ''}
        {leg.isRealtime ? (
          <span className="ml-1 font-medium text-green-800">Tempo real</span>
        ) : null}
      </p>
    </>
  );
}

/** Itinerários encontrados: resumo de cada opção e os trechos da opção selecionada. */
export function ItineraryList({
  status,
  itineraries,
  selectedIndex,
  onSelect,
  errorMessage,
}: ItineraryListProps) {
  if (status === 'idle') return null;
  if (status === 'loading') {
    return (
      <p role="status" className="text-sm text-neutral-600">
        Procurando itinerários...
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p role="alert" className="text-sm text-red-700">
        {errorMessage ?? 'Não foi possível planejar a viagem. Tente de novo.'}
      </p>
    );
  }
  if (itineraries.length === 0) {
    return (
      <p role="status" className="text-sm text-neutral-600">
        Nenhum itinerário encontrado para esse trajeto.
      </p>
    );
  }

  const selected = itineraries[selectedIndex];

  return (
    <section aria-labelledby="itineraries-title" className="space-y-3">
      <h2 id="itineraries-title" className="text-base font-semibold">
        Itinerários
      </h2>
      <ul className="space-y-2">
        {itineraries.map((itinerary, index) => {
          const isSelected = index === selectedIndex;
          return (
            <li key={`${itinerary.startAt}-${index}`}>
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(index)}
                className={`w-full rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  isSelected ? 'border-blue-700 bg-blue-50' : 'border-neutral-200 bg-white'
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold tabular-nums">
                    {formatTime(itinerary.startAt)} até {formatTime(itinerary.endAt)}
                  </span>
                  <span className="font-semibold">{formatDuration(itinerary.durationS)}</span>
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5">
                  {itinerary.legs.map((leg, legIndex) => (
                    <span key={legIndex} className="inline-flex items-center gap-1.5">
                      {legIndex > 0 ? (
                        <span aria-hidden="true" className="text-neutral-400">
                          ›
                        </span>
                      ) : null}
                      <LegChip leg={leg} />
                    </span>
                  ))}
                </span>
                <span className="mt-2 block text-sm text-neutral-600">
                  {formatTransfers(itinerary.transfers)}, {formatDistance(itinerary.walkDistanceM)}{' '}
                  a pé
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected ? (
        <section aria-labelledby="itinerary-legs-title">
          <h3 id="itinerary-legs-title" className="mb-2 text-sm font-semibold">
            Trechos do itinerário {selectedIndex + 1}
          </h3>
          <ol className="space-y-3">
            {selected.legs.map((leg, legIndex) => (
              <li key={legIndex} className="flex gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: legColor(leg),
                    color: readableTextColor(legColor(leg)),
                  }}
                >
                  <ModeIcon mode={leg.mode} className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <LegDetail leg={leg} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}
