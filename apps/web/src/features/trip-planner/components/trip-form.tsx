'use client';

import type { Place } from '@baldeacao/types';
import { useId } from 'react';

import { SwapIcon } from '@/shared/ui/icons';

import type { RenderPlaceInput, TripField } from '../types';

export interface TripFormProps {
  /** Campo de lugar (a página passa o PlaceAutocomplete de features/place-search). */
  renderPlaceInput: RenderPlaceInput;
  origin: Place | null;
  destination: Place | null;
  onOriginChange: (place: Place | null) => void;
  onDestinationChange: (place: Place | null) => void;
  onSwap: () => void;
  /** Campo que recebe o foco ao abrir a tela. */
  autoFocus?: TripField | null;
  /** "Escolher no mapa" no campo indicado. */
  onPickOnMap?: (field: TripField) => void;
  /** Erro do par origem e destino (ex.: iguais). */
  error?: string | null;
  /** Pede o foco num campo; trocar `key` repete o pedido. */
  focusRequest?: { field: TripField; key: number } | null;
}

/**
 * Cartão compacto de origem (anel) e destino (alfinete) ligados por linha pontilhada, com
 * botão de inverter. Sem botão de buscar: a busca roda sozinha quando as duas pontas existem.
 */
export function TripForm({
  renderPlaceInput,
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  onSwap,
  autoFocus = null,
  onPickOnMap,
  error,
  focusRequest = null,
}: TripFormProps) {
  const focusKeyFor = (field: TripField) =>
    focusRequest?.field === field ? { focusKey: focusRequest.key } : {};
  const baseId = useId();
  const errorId = `${baseId}-error`;

  return (
    <form
      role="search"
      aria-label="Origem e destino"
      aria-describedby={error ? errorId : undefined}
      onSubmit={(event) => event.preventDefault()}
      noValidate
    >
      <div className="flex items-center gap-1 rounded-sm border-[1.5px] border-border-strong bg-surface p-1 pl-3">
        <div
          aria-hidden="true"
          className="flex w-4 shrink-0 flex-col items-center self-stretch py-5"
        >
          <span className="size-3.5 shrink-0 rounded-full border-[3px] border-text" />
          <span className="my-1 w-0 flex-1 border-l-2 border-dotted border-muted" />
          <svg viewBox="0 0 16 20" className="h-4 w-3.5 shrink-0 fill-brand">
            <path d="M8 20s7-6.2 7-11.5A7 7 0 0 0 1 8.5C1 13.8 8 20 8 20Zm0-8.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1 divide-y divide-border">
          {renderPlaceInput({
            id: `${baseId}-origin`,
            label: 'Origem',
            value: origin,
            onChange: onOriginChange,
            placeholder: 'De onde?',
            autoFocus: autoFocus === 'origin',
            ...focusKeyFor('origin'),
            ...(onPickOnMap ? { onPickOnMap: () => onPickOnMap('origin') } : {}),
          })}
          {renderPlaceInput({
            id: `${baseId}-destination`,
            label: 'Destino',
            value: destination,
            onChange: onDestinationChange,
            placeholder: 'Para onde?',
            autoFocus: autoFocus === 'destination',
            ...focusKeyFor('destination'),
            ...(onPickOnMap ? { onPickOnMap: () => onPickOnMap('destination') } : {}),
          })}
        </div>
        <button
          type="button"
          onClick={onSwap}
          aria-label="Inverter origem e destino"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <SwapIcon />
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}
