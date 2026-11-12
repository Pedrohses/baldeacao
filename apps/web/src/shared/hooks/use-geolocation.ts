'use client';

import type { Coordinates } from '@baldeacao/types';
import { useSyncExternalStore } from 'react';

export type GeolocationStatus = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable';

export interface GeolocationState {
  status: GeolocationStatus;
  position: Coordinates | null;
}

// Um estado só para o app inteiro: o botão do mapa, a lista de paradas e o campo de lugar
// enxergam a mesma posição sem pedir permissão de novo.
const IDLE: GeolocationState = { status: 'idle', position: null };
let state: GeolocationState = IDLE;
let pending: Promise<Coordinates | null> | null = null;
const listeners = new Set<() => void>();

function setState(next: GeolocationState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function hasGeolocation(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/** Pede a posição atual; devolve null se o usuário negar ou o aparelho não tiver GPS. */
export function locate(): Promise<Coordinates | null> {
  if (!hasGeolocation()) {
    setState({ status: 'unavailable', position: state.position });
    return Promise.resolve(null);
  }
  if (pending) return pending;
  setState({ status: 'locating', position: state.position });
  pending = new Promise<Coordinates | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { lat: coords.latitude, lon: coords.longitude };
        setState({ status: 'located', position });
        resolve(position);
      },
      (error) => {
        setState({
          status: error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable',
          position: state.position,
        });
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }).finally(() => {
    pending = null;
  });
  return pending;
}

/** Localiza só se a permissão já foi dada (sem abrir o pedido do navegador). */
export async function locateIfPermitted(): Promise<Coordinates | null> {
  if (!hasGeolocation() || !navigator.permissions?.query) return null;
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state === 'granted' ? locate() : null;
  } catch {
    return null;
  }
}

/** Só para testes: volta ao estado inicial. */
export function resetGeolocation() {
  pending = null;
  setState(IDLE);
}

export function useGeolocation(): GeolocationState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => IDLE,
  );
}
