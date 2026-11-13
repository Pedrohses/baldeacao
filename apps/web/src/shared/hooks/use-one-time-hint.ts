'use client';

import { useCallback, useSyncExternalStore } from 'react';

import { isHintSeen, markHintSeen } from '@/shared/lib/storage';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Dica que aparece até a pessoa dispensar ou usar o recurso, lembrada no aparelho. No servidor
 * conta como vista, para não piscar na hidratação.
 */
export function useOneTimeHint(hint: string) {
  const seen = useSyncExternalStore(
    subscribe,
    () => isHintSeen(hint),
    () => true,
  );
  const dismiss = useCallback(() => {
    markHintSeen(hint);
    for (const listener of listeners) listener();
  }, [hint]);
  return { visible: !seen, dismiss };
}
