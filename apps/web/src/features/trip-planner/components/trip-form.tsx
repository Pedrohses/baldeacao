'use client';

import type { Place, TripRequest } from '@baldeacao/types';
import { useId, useState, type FormEvent } from 'react';

import { buildTripRequest, type TripFormErrors } from '../schemas';
import type { RenderPlaceInput } from '../types';

export interface TripFormProps {
  /** Campo de lugar (a página passa o PlaceAutocomplete de features/place-search). */
  renderPlaceInput: RenderPlaceInput;
  onSubmit: (request: TripRequest) => void;
  isSubmitting?: boolean;
  initialOrigin?: Place | null;
  initialDestination?: Place | null;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-red-700">
      {message}
    </p>
  );
}

/** Origem, destino, inverter e hora de saída opcional; entrega um TripRequest válido. */
export function TripForm({
  renderPlaceInput,
  onSubmit,
  isSubmitting = false,
  initialOrigin = null,
  initialDestination = null,
}: TripFormProps) {
  const baseId = useId();
  const [origin, setOrigin] = useState<Place | null>(initialOrigin);
  const [destination, setDestination] = useState<Place | null>(initialDestination);
  const [departAt, setDepartAt] = useState('');
  const [errors, setErrors] = useState<TripFormErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = buildTripRequest({ origin, destination, departAt });
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSubmit(result.request);
  }

  function clearError(field: keyof TripFormErrors) {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  }

  function handleSwap() {
    setOrigin(destination);
    setDestination(origin);
    setErrors({});
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Planejar viagem" className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            {renderPlaceInput({
              id: `${baseId}-origin`,
              label: 'Origem',
              value: origin,
              onChange: (place) => {
                setOrigin(place);
                clearError('origin');
              },
              placeholder: 'De onde você sai?',
            })}
            <FieldError id={`${baseId}-origin-error`} message={errors.origin} />
          </div>
          <div>
            {renderPlaceInput({
              id: `${baseId}-destination`,
              label: 'Destino',
              value: destination,
              onChange: (place) => {
                setDestination(place);
                clearError('destination');
              },
              placeholder: 'Para onde você vai?',
            })}
            <FieldError id={`${baseId}-destination-error`} message={errors.destination} />
          </div>
        </div>
        <button
          type="button"
          onClick={handleSwap}
          aria-label="Inverter origem e destino"
          className="mb-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className="size-5"
          >
            <path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" />
          </svg>
        </button>
      </div>

      <div>
        <label
          htmlFor={`${baseId}-depart-at`}
          className="mb-1 block text-sm font-medium text-neutral-800"
        >
          Hora de saída (opcional)
        </label>
        <div className="flex gap-2">
          <input
            id={`${baseId}-depart-at`}
            type="datetime-local"
            value={departAt}
            onChange={(event) => setDepartAt(event.target.value)}
            aria-invalid={errors.departAt ? true : undefined}
            aria-describedby={
              errors.departAt ? `${baseId}-depart-at-error` : `${baseId}-depart-at-hint`
            }
            className="h-10 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          />
          {departAt ? (
            <button
              type="button"
              onClick={() => setDepartAt('')}
              className="h-10 shrink-0 rounded-lg border border-neutral-300 bg-white px-3 text-sm hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Sair agora
            </button>
          ) : null}
        </div>
        {errors.departAt ? null : (
          <p id={`${baseId}-depart-at-hint`} className="mt-1 text-sm text-neutral-600">
            Sem hora, a viagem parte agora.
          </p>
        )}
        <FieldError id={`${baseId}-depart-at-error`} message={errors.departAt} />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-lg bg-blue-700 px-4 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Buscando...' : 'Buscar itinerários'}
      </button>
    </form>
  );
}
