'use client';

import type { Place } from '@baldeacao/types';
import { useState } from 'react';

import { buildTripRequest, type TripFormResult } from '../schemas';
import { TRIP_TIME_NOW, type TripTime } from '../utils/trip-time';

export interface UseTripRequestOptions {
  initialOrigin?: Place | null;
  initialDestination?: Place | null;
}

/**
 * Estado de origem, destino e hora e o pedido derivado: com as duas pontas definidas o pedido
 * fica pronto sozinho (sem botão "Buscar") e muda quando a hora muda.
 */
export function useTripRequest({
  initialOrigin = null,
  initialDestination = null,
}: UseTripRequestOptions = {}) {
  const [origin, setOrigin] = useState<Place | null>(initialOrigin);
  const [destination, setDestination] = useState<Place | null>(initialDestination);
  const [time, setTime] = useState<TripTime>(TRIP_TIME_NOW);
  // O "agora" do pedido fica fixo até a próxima mudança: mantém a chave do cache estável.
  const [now, setNow] = useState(() => new Date());

  const result: TripFormResult = buildTripRequest({ origin, destination, time }, now);

  return {
    origin,
    destination,
    time,
    setOrigin,
    setDestination,
    setTime(next: TripTime) {
      setNow(new Date());
      setTime(next);
    },
    swap() {
      setOrigin(destination);
      setDestination(origin);
    },
    request: result.status === 'ready' ? result.request : null,
    error: result.status === 'invalid' ? result.message : null,
  };
}
