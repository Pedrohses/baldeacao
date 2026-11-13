'use client';

import type { Stop } from '@baldeacao/types';
import type { ReactNode } from 'react';

import { CloseIcon } from '@/shared/ui/icons';

import { ArrivalsList } from './arrivals-list';

export interface StopSheetProps {
  stop: Stop;
  onClose: () => void;
  /**
   * Ações da parada (ex.: "Ir para cá" e "Sair daqui"). Vêm de quem compõe a tela, porque
   * stops não conhece o planejador.
   */
  actions?: ReactNode;
}

/** Conteúdo do painel para a parada selecionada: nome, ações e próximas chegadas. */
export function StopSheet({ stop, onClose, actions }: StopSheetProps) {
  return (
    <section aria-labelledby="stop-sheet-title">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 pt-2">
          <p className="text-xs font-bold text-muted uppercase">Parada</p>
          <h2 id="stop-sheet-title" className="screen-title">
            {stop.name}
          </h2>
          {stop.description ? <p className="text-sm text-muted">{stop.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar painel da parada"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <CloseIcon />
        </button>
      </header>
      {actions ? <div className="mb-4 flex flex-wrap gap-2">{actions}</div> : null}
      <ArrivalsList stopId={stop.id} />
    </section>
  );
}
