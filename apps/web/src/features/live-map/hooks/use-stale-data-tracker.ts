'use client';

import { useEffect } from 'react';

import { useMapStore } from './use-map-store';

/** Intervalo com que o relógio reavalia `isStale` quando nenhum dado novo chega. */
export const STALENESS_CHECK_INTERVAL_MS = 5_000;

/**
 * Leva o `updatedAt` do snapshot atual para o store e reavalia o atraso periodicamente,
 * para o aviso aparecer mesmo quando o socket para de mandar ciclos.
 */
export function useStaleDataTracker(updatedAt: string | undefined) {
  const reportDataUpdatedAt = useMapStore((state) => state.reportDataUpdatedAt);
  const checkStaleness = useMapStore((state) => state.checkStaleness);

  useEffect(() => {
    if (updatedAt) reportDataUpdatedAt(updatedAt);
  }, [updatedAt, reportDataUpdatedAt]);

  useEffect(() => {
    const timer = setInterval(() => checkStaleness(), STALENESS_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [checkStaleness]);
}
