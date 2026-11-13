'use client';

import { useState } from 'react';

export interface RollingNumberProps {
  value: number;
  className?: string;
}

interface Shown {
  current: number;
  previous: number | null;
}

/**
 * Número de letreiro (MASTER.md): quando muda, o antigo sobe e sai e o novo entra por baixo,
 * em 220 ms. Só transform e opacity; com movimento reduzido o CSS global zera a animação.
 */
export function RollingNumber({ value, className = '' }: RollingNumberProps) {
  const [shown, setShown] = useState<Shown>({ current: value, previous: null });
  // Estado derivado do valor anterior (padrão do React para "valor da renderização passada").
  if (shown.current !== value) setShown({ current: value, previous: shown.current });

  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      {shown.previous !== null ? (
        <span
          key={`out-${shown.previous}`}
          aria-hidden="true"
          className="absolute inset-0 animate-roll-out text-right"
          onAnimationEnd={() => setShown((s) => ({ ...s, previous: null }))}
        >
          {shown.previous}
        </span>
      ) : null}
      <span key={shown.current} className={shown.previous !== null ? 'animate-roll-in' : ''}>
        {shown.current}
      </span>
    </span>
  );
}
