'use client';

import { ClockIcon } from './icons';
import { RollingNumber } from './rolling-number';

export type ArrivalTimeSize = 'sm' | 'md';

export interface ArrivalTimeProps {
  /** Minutos inteiros até a chegada (já arredondados, nunca negativos). */
  minutes: number;
  /** Tempo real (Olho Vivo) ou previsão de tabela (GTFS). */
  isRealtime: boolean;
  size?: ArrivalTimeSize;
  className?: string;
}

// "Agora" um degrau abaixo do número: em caixa alta ele já pesa mais que um dígito.
const NOW_CLASS: Record<ArrivalTimeSize, string> = {
  sm: 'text-xl',
  md: 'text-2xl',
};

const NUMBER_CLASS: Record<ArrivalTimeSize, string> = {
  sm: 'text-2xl',
  md: 'text-[2rem]',
};

/**
 * Tempo até a chegada no padrão de quadro de partidas: número em Barlow Condensed 700 que vira
 * como letreiro quando muda, e unidade menor.
 * Tempo real leva o ponto verde; tabela fica em cinza com relógio. Menos de 1 min vira "agora".
 */
export function ArrivalTime({
  minutes,
  isRealtime,
  size = 'md',
  className = '',
}: ArrivalTimeProps) {
  const now = minutes < 1;
  return (
    <span
      data-testid="arrival-time"
      className={`inline-flex shrink-0 items-baseline gap-1.5 leading-none tabular-nums ${className}`}
    >
      {isRealtime ? (
        <span aria-hidden="true" className="size-2 shrink-0 self-center rounded-full bg-live" />
      ) : (
        <ClockIcon className="size-3.5 shrink-0 self-center text-muted" />
      )}
      <span className="sr-only">{isRealtime ? 'Tempo real: ' : 'Pela tabela: '}</span>
      {now ? (
        <span
          className={`font-display font-bold tracking-[0.04em] text-live uppercase ${NOW_CLASS[size]}`}
        >
          agora
        </span>
      ) : (
        <>
          <RollingNumber
            value={minutes}
            className={`font-display font-bold ${NUMBER_CLASS[size]} ${isRealtime ? 'text-text' : 'text-muted'}`}
          />
          <span className="text-sm font-medium text-muted">min</span>
        </>
      )}
    </span>
  );
}
