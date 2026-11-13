'use client';

import { useId } from 'react';

import { ChevronDownIcon, ClockIcon } from '@/shared/ui/icons';

import {
  MINUTE_STEP,
  TRIP_TIME_NOW,
  type TripDay,
  type TripTime,
  type TripTimeMode,
  effectiveTripTime,
  nextSlot,
  tripTimeLabel,
} from '../utils/trip-time';

export interface TimeChipProps {
  value: TripTime;
  onChange: (time: TripTime) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Relógio de referência para abrir o seletor perto de agora (testes fixam). */
  now?: Date;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
const pad = (n: number) => String(n).padStart(2, '0');

function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="flex rounded-sm bg-surface-2 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="relative flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[6px] text-sm font-bold has-checked:bg-surface has-checked:text-brand-ink has-focus-visible:outline-3 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Chip "Sair agora" que abre o seletor Sair às | Chegar até, Hoje | Amanhã e hora 24 h. */
export function TimeChip({ value, onChange, open, onOpenChange, now = new Date() }: TimeChipProps) {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const current = value.kind === 'now' ? { kind: 'depart' as const, ...nextSlot(now) } : value;
  // "Hoje" num horário que já passou vale para amanhã: o seletor mostra o dia que vale.
  const effective = effectiveTripTime(current, now);
  const movedToTomorrow = effective.kind !== 'now' && effective.day !== current.day;

  function update(patch: Partial<Extract<TripTime, { kind: TripTimeMode }>>) {
    onChange({ ...current, ...patch });
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
        className={`inline-flex h-11 items-center gap-2 rounded-sm border px-4 text-sm font-semibold transition-colors ${
          value.kind === 'now'
            ? 'border-border bg-surface text-text'
            : 'border-brand-ink bg-brand/10 text-brand-ink'
        }`}
      >
        <ClockIcon className="size-4" />
        {tripTimeLabel(value, now)}
        <ChevronDownIcon className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div
        id={panelId}
        hidden={!open}
        role="group"
        aria-label="Hora da viagem"
        className="mt-2 space-y-3 rounded-md border border-border bg-surface p-3"
      >
        <Segmented
          name={`${baseId}-mode`}
          legend="Tipo de horário"
          value={current.kind}
          onChange={(kind) => update({ kind })}
          options={[
            { value: 'depart', label: 'Sair às' },
            { value: 'arrive', label: 'Chegar até' },
          ]}
        />
        <Segmented
          name={`${baseId}-day`}
          legend="Dia"
          value={movedToTomorrow ? 'tomorrow' : current.day}
          onChange={(day: TripDay) => update({ day })}
          options={[
            { value: 'today', label: 'Hoje' },
            { value: 'tomorrow', label: 'Amanhã' },
          ]}
        />
        {movedToTomorrow ? (
          <p className="text-sm text-muted">Esse horário já passou hoje; vale para amanhã.</p>
        ) : null}
        <div className="flex items-end gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
            Hora
            <select
              value={current.hour}
              onChange={(event) => update({ hour: Number(event.target.value) })}
              className="h-11 rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base font-bold text-text tabular-nums"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
          </label>
          <span aria-hidden="true" className="pb-2.5 text-xl font-bold">
            :
          </span>
          <label className="flex flex-1 flex-col gap-1 text-sm text-muted">
            Minutos
            <select
              value={current.minute - (current.minute % MINUTE_STEP)}
              onChange={(event) => update({ minute: Number(event.target.value) })}
              className="h-11 rounded-sm border-[1.5px] border-border-strong bg-surface px-2 text-base font-bold text-text tabular-nums"
            >
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange(TRIP_TIME_NOW);
              onOpenChange(false);
            }}
            className="h-11 flex-1 rounded-sm border border-border px-4 text-sm font-bold"
          >
            Sair agora
          </button>
          <button
            type="button"
            onClick={() => {
              if (value.kind === 'now') onChange(current);
              onOpenChange(false);
            }}
            className="h-11 flex-1 rounded-sm bg-brand px-4 text-sm font-bold text-brand-fg"
          >
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
