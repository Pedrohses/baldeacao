'use client';

import type { Stop } from '@baldeacao/types';

import { ArrivalsList } from './arrivals-list';

export interface StopSheetProps {
  stop: Stop;
  onClose: () => void;
}

/** Painel da parada selecionada, com as próximas chegadas. */
export function StopSheet({ stop, onClose }: StopSheetProps) {
  return (
    <section aria-labelledby="stop-sheet-title" className="rounded-t-2xl bg-white p-4 shadow-lg">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="stop-sheet-title" className="text-lg font-semibold">
            {stop.name}
          </h2>
          {stop.description ? (
            <p className="text-sm text-neutral-600">{stop.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel da parada"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <ArrivalsList stopId={stop.id} />
    </section>
  );
}
