import {
  POSITIONS_ALL_CHANNEL,
  type PositionsChannel,
  type PositionsUpdate,
  type VehicleSnapshot,
} from '@baldeacao/types';
import { positionsUpdateExample, vehicleSnapshotExample } from '@baldeacao/types/examples';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { PositionsListener } from '@/shared/lib/realtime-client';

import { vehicleKeys } from '../services/query-keys';
import { vehiclePositionsService } from '../services/vehicle-positions.service';
import { applyPositionsUpdate, useVehiclePositions } from './use-vehicle-positions';

// Socket falso: guarda as assinaturas para o teste emitir updates.
const fakeSocket = vi.hoisted(() => {
  const subscriptions = new Map<string, Set<(update: unknown) => void>>();
  return {
    subscriptions,
    subscribe: vi.fn((channel: string, listener: (update: unknown) => void) => {
      const set = subscriptions.get(channel) ?? new Set();
      set.add(listener);
      subscriptions.set(channel, set);
      return () => {
        set.delete(listener);
        if (set.size === 0) subscriptions.delete(channel);
      };
    }),
  };
});

vi.mock('@/shared/lib/realtime-client', () => ({
  subscribePositions: (channel: PositionsChannel, listener: PositionsListener) =>
    fakeSocket.subscribe(channel, listener as (update: unknown) => void),
}));

vi.mock('../services/vehicle-positions.service', () => ({
  vehiclePositionsService: { getSnapshot: vi.fn() },
}));

const getSnapshot = vi.mocked(vehiclePositionsService.getSnapshot);

function emit(update: PositionsUpdate) {
  act(() => {
    for (const listener of fakeSocket.subscriptions.get(update.channel) ?? []) listener(update);
  });
}

function setup(routeId?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ id }: { id?: string }) => useVehiclePositions(id), {
    wrapper,
    initialProps: { id: routeId },
  });
  return { queryClient, ...hook };
}

function withoutChannel({ sourceId, routeId, updatedAt, vehicles }: PositionsUpdate) {
  return { sourceId, routeId, updatedAt, vehicles };
}

const lineSnapshot: VehicleSnapshot = { ...vehicleSnapshotExample, routeId: '875A-10' };

describe('useVehiclePositions', () => {
  beforeEach(() => {
    fakeSocket.subscriptions.clear();
    fakeSocket.subscribe.mockClear();
    getSnapshot.mockReset();
  });

  it('busca o snapshot e assina o canal de todas as linhas', async () => {
    getSnapshot.mockResolvedValue(vehicleSnapshotExample);
    const { result } = setup();

    await waitFor(() => expect(result.current.data).toEqual(vehicleSnapshotExample));
    expect(getSnapshot).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    expect(fakeSocket.subscribe).toHaveBeenCalledWith(POSITIONS_ALL_CHANNEL, expect.any(Function));
  });

  it('aplica cada positions:update no cache da linha', async () => {
    getSnapshot.mockResolvedValue(lineSnapshot);
    const { result, queryClient } = setup('875A-10');
    await waitFor(() => expect(result.current.data).toEqual(lineSnapshot));
    expect(fakeSocket.subscribe).toHaveBeenCalledWith(
      'positions:line:875A-10',
      expect.any(Function),
    );

    const moved: PositionsUpdate = {
      ...positionsUpdateExample,
      updatedAt: '2026-11-12T15:35:00Z',
      vehicles: [
        { ...positionsUpdateExample.vehicles[0]!, location: { lat: -23.56, lon: -46.662 } },
      ],
    };
    emit(moved);

    const expected = withoutChannel(moved);
    expect(queryClient.getQueryData(vehicleKeys.positions('875A-10'))).toEqual(expected);
    // O QueryCache notifica os observadores de forma assíncrona.
    await waitFor(() => expect(result.current.data).toEqual(expected));
  });

  it('cancela a assinatura ao desmontar e ao trocar de linha', async () => {
    getSnapshot.mockResolvedValue(lineSnapshot);
    const { rerender, unmount } = setup('875A-10');
    await waitFor(() => expect(fakeSocket.subscriptions.has('positions:line:875A-10')).toBe(true));

    rerender({ id: '8000-10' });
    expect(fakeSocket.subscriptions.has('positions:line:875A-10')).toBe(false);
    expect(fakeSocket.subscriptions.has('positions:line:8000-10')).toBe(true);

    unmount();
    expect(fakeSocket.subscriptions.size).toBe(0);
  });
});

describe('applyPositionsUpdate', () => {
  it('remove o canal e substitui o snapshot', () => {
    expect(applyPositionsUpdate(undefined, positionsUpdateExample)).toEqual(
      withoutChannel(positionsUpdateExample),
    );
  });

  it('ignora update mais antigo que o snapshot atual', () => {
    const current: VehicleSnapshot = { ...lineSnapshot, updatedAt: '2026-11-12T15:40:00Z' };
    expect(applyPositionsUpdate(current, positionsUpdateExample)).toBe(current);
  });
});
