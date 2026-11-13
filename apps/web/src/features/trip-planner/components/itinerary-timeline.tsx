import type { Itinerary, Leg } from '@baldeacao/types';

import {
  WALK_COLOR,
  formatDistance,
  formatDuration,
  formatStops,
  formatTime,
  legColor,
  minutesBetween,
  walkWaitSeconds,
  WALK_SPEED_MS,
  isTinyWalk,
  placeLabel,
} from '../utils/format';
import { LineChip } from './itinerary-card';

export interface ItineraryTimelineProps {
  itinerary: Itinerary;
  /** Trecho em destaque no mapa; null destaca todos. */
  focusedLeg: number | null;
  onFocusLeg: (index: number | null) => void;
  /** Nome do destino escolhido (o OTP costuma mandar só "Destino"). */
  destinationName?: string;
}

function Rail({ leg, transfer }: { leg: Leg; transfer: boolean }) {
  const isWalk = leg.mode === 'walk';
  const color = legColor(leg);
  return (
    <span aria-hidden="true" className="relative flex w-6 shrink-0 justify-center">
      {isWalk ? (
        <span
          className="absolute top-2 bottom-0 w-0 border-l-[3px] border-dotted"
          style={{ borderColor: WALK_COLOR }}
        />
      ) : (
        <span
          className="absolute top-2 -bottom-2 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {transfer ? (
        <span
          className="relative mt-0 size-[18px] rounded-full border-4 bg-surface"
          style={{ borderColor: color }}
        />
      ) : (
        <span
          className="relative mt-0.5 size-3.5 rounded-full border-2 border-surface"
          style={{ backgroundColor: isWalk ? WALK_COLOR : color }}
        />
      )}
    </span>
  );
}

function LegText({ leg }: { leg: Leg }) {
  if (leg.mode === 'walk') {
    const wait = walkWaitSeconds(leg);
    return (
      <p className="font-semibold">
        {wait > 0
          ? `Caminhe ${formatDistance(leg.distanceM)} (${formatDuration(leg.distanceM / WALK_SPEED_MS)}) e aguarde ${formatDuration(wait)}`
          : `Caminhe ${formatDistance(leg.distanceM)} (${formatDuration(leg.durationS)})`}{' '}
        até {placeLabel(leg.to.name)}
      </p>
    );
  }
  return (
    <>
      <p className="flex flex-wrap items-center gap-1.5">
        <LineChip leg={leg} />
        {leg.headsign ? <span className="font-semibold">sentido {leg.headsign}</span> : null}
      </p>
      <p className="mt-1">Embarque em {placeLabel(leg.from.name)}</p>
      <p className="text-sm text-muted">
        {formatStops(leg.intermediateStops)} · {formatDuration(leg.durationS)}
      </p>
      <p>
        Desça em {placeLabel(leg.to.name)}{' '}
        <span className="text-sm text-muted tabular-nums">às {formatTime(leg.endAt)}</span>
      </p>
      <p className="mt-1">
        {leg.isRealtime ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-live/15 px-2 py-0.5 text-xs font-bold text-live">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-live" />
            ao vivo
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">
            horário previsto
          </span>
        )}
      </p>
    </>
  );
}

/**
 * Linha do tempo do itinerário: coluna de hora, trilho na cor da linha (caminhada pontilhada,
 * baldeação em anel) e o texto de cada trecho. Tocar num trecho o destaca no mapa.
 */
export function ItineraryTimeline({
  itinerary,
  focusedLeg,
  onFocusLeg,
  destinationName,
}: ItineraryTimelineProps) {
  const last = itinerary.legs.at(-1);
  // Trecho de transporte anterior de cada embarque: se existe, o embarque é uma baldeação.
  const transferFrom = itinerary.legs.map((leg, index) =>
    leg.mode === 'walk'
      ? null
      : (itinerary.legs.slice(0, index).findLast((other) => other.mode !== 'walk') ?? null),
  );

  return (
    <ol aria-label="Trechos da viagem" className="space-y-1">
      {itinerary.legs.map((leg, index) => {
        if (isTinyWalk(leg)) return null;
        const previous = transferFrom[index] ?? null;
        const focused = focusedLeg === index;
        return (
          <li key={index}>
            {previous ? (
              <p className="my-1 ml-[80px] rounded-sm bg-surface-2 px-3 py-2 text-sm font-bold">
                Baldeação · {minutesBetween(previous.endAt, leg.startAt)} min
              </p>
            ) : null}
            <button
              type="button"
              aria-pressed={focused}
              onClick={() => onFocusLeg(focused ? null : index)}
              className={`flex w-full gap-0 rounded-sm py-2 text-left transition-colors ${focused ? 'bg-brand/10' : 'hover:bg-surface-2'}`}
            >
              <span className="w-14 shrink-0 pt-0.5 text-right text-sm font-extrabold tabular-nums">
                {formatTime(leg.startAt)}
              </span>
              <Rail leg={leg} transfer={previous !== null} />
              <span className="min-w-0 flex-1 pr-2">
                <LegText leg={leg} />
              </span>
            </button>
          </li>
        );
      })}
      {last ? (
        <li className="flex py-2">
          <span className="w-14 shrink-0 pt-0.5 text-right text-sm font-extrabold tabular-nums">
            {formatTime(itinerary.endAt)}
          </span>
          <span aria-hidden="true" className="flex w-6 shrink-0 justify-center">
            <span className="mt-0.5 size-3.5 rounded-full border-[3px] border-text bg-surface" />
          </span>
          <span className="font-semibold">
            Chegada em {destinationName ?? placeLabel(last.to.name)}
          </span>
        </li>
      ) : null}
    </ol>
  );
}
