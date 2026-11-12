import type { Itinerary, Leg } from '@baldeacao/types';
import type { CSSProperties } from 'react';

import { CheckIcon } from '@/shared/ui/icons';

import {
  MODE_LABELS,
  WALK_COLOR,
  formatDeparture,
  formatDistance,
  formatDuration,
  formatTime,
  formatTransfers,
  legColor,
  readableTextColor,
  shortRouteName,
} from '../utils/format';
import { ModeIcon } from './mode-icon';

export interface ItineraryCardProps {
  itinerary: Itinerary;
  selected: boolean;
  onSelect: () => void;
  now: Date;
}

const WALK_DOTS: CSSProperties = {
  backgroundImage: `radial-gradient(circle, ${WALK_COLOR} 1.5px, transparent 1.75px)`,
  backgroundSize: '6px 8px',
  backgroundPosition: 'center',
};

/** Barra de 8 px com os trechos proporcionais à duração (mínimo de 6 px cada). */
function LegBar({ legs }: { legs: readonly Leg[] }) {
  return (
    <span aria-hidden="true" className="mt-3 flex h-2 w-full gap-0.5">
      {legs.map((leg, index) => (
        <span
          key={index}
          data-testid="leg-bar-segment"
          className="h-full min-w-1.5 rounded-full"
          style={{
            flexGrow: Math.max(leg.durationS, 1),
            flexBasis: 0,
            ...(leg.mode === 'walk' ? WALK_DOTS : { backgroundColor: legColor(leg) }),
          }}
        />
      ))}
    </span>
  );
}

/** Selo da linha: ícone do modo + nome curto ("L4", "746H-10") na cor da linha. */
export function LineChip({ leg }: { leg: Leg }) {
  const background = legColor(leg);
  const name = shortRouteName(leg.routeShortName) ?? MODE_LABELS[leg.mode];
  return (
    <span
      data-testid="leg-badge"
      className="inline-flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-sm font-bold"
      style={{ backgroundColor: background, color: readableTextColor(background) }}
    >
      <ModeIcon mode={leg.mode} />
      <span className="sr-only">{MODE_LABELS[leg.mode]} </span>
      {name}
    </span>
  );
}

/** Opção de itinerário: horários, duração, barra dos trechos, linhas e resumo. */
export function ItineraryCard({ itinerary, selected, onSelect, now }: ItineraryCardProps) {
  const transit = itinerary.legs.filter((leg) => leg.mode !== 'walk');
  const isRealtime = itinerary.legs.some((leg) => leg.isRealtime);
  const departure = formatDeparture(itinerary.startAt, now);
  const start = formatTime(itinerary.startAt);
  const end = formatTime(itinerary.endAt);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative w-full rounded-md border-2 bg-surface p-3 text-left transition-colors ${
        selected ? 'border-brand' : 'border-border hover:border-muted'
      }`}
    >
      <span className="flex items-baseline justify-between gap-2 pr-7">
        <span className="font-mono text-xl font-bold">
          <span aria-hidden="true">
            {start} → {end}
          </span>
          <span className="sr-only">
            Das {start} às {end},
          </span>
        </span>
        <span className="font-bold">{formatDuration(itinerary.durationS)}</span>
      </span>
      {selected ? (
        <span className="absolute top-3 right-3 inline-flex size-5 items-center justify-center rounded-full bg-brand text-brand-fg">
          <CheckIcon className="size-3.5" />
        </span>
      ) : null}
      <LegBar legs={itinerary.legs} />
      {transit.length > 0 ? (
        <span className="mt-3 flex flex-wrap items-center gap-1.5">
          {transit.map((leg, index) => (
            <LineChip key={index} leg={leg} />
          ))}
        </span>
      ) : null}
      <span className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
        {isRealtime ? (
          <span className="inline-flex items-center gap-1 text-live">
            <span aria-hidden="true" className="size-2 rounded-full bg-live" />
            <span className="sr-only">ao vivo,</span>
          </span>
        ) : null}
        <span className={departure.tone === 'now' ? 'font-bold text-warn' : ''}>
          {departure.text}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatTransfers(itinerary.transfers)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatDistance(itinerary.walkDistanceM)} a pé</span>
      </span>
    </button>
  );
}
