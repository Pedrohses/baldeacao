'use client';

import { useEffect, useState } from 'react';

/** Data atual, atualizada a cada `intervalMs`, para contagens regressivas na tela. */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
