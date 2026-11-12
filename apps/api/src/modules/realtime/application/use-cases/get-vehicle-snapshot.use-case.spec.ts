import { VehicleSnapshotSchema } from '@baldeacao/types';
import {
  InMemoryPositionsStore,
  rawPositionsFixture,
} from '../../../../../test/realtime/in-memory-realtime';
import { RealtimeDataNotReadyError } from '../../domain/errors/realtime-data-not-ready.error';
import { mapOlhoVivoPositions } from '../../infrastructure/adapters/olho-vivo-position.mapper';
import { GetVehicleSnapshotUseCase } from './get-vehicle-snapshot.use-case';

const UPDATED_AT = '2026-11-12T15:34:30.000Z';

async function setup() {
  const store = new InMemoryPositionsStore();
  await store.replace(
    'sptrans',
    mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans'),
    UPDATED_AT,
  );
  return { store, useCase: new GetVehicleSnapshotUseCase(store) };
}

describe('GetVehicleSnapshotUseCase', () => {
  it('devolve todas as linhas quando routeId é null', async () => {
    const { useCase } = await setup();

    const snapshot = await useCase.execute({ sourceId: 'sptrans', routeId: null });

    expect(VehicleSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot).toMatchObject({ sourceId: 'sptrans', routeId: null, updatedAt: UPDATED_AT });
    expect(snapshot.vehicles).toHaveLength(4);
  });

  it('filtra pela linha, nos dois sentidos', async () => {
    const { useCase } = await setup();

    const snapshot = await useCase.execute({ sourceId: 'sptrans', routeId: '875A-10' });

    expect(snapshot.routeId).toBe('875A-10');
    expect(snapshot.vehicles.map((v) => v.vehicleId).sort()).toEqual(['11433', '11502', '11611']);
  });

  it('linha sem veículo no momento devolve lista vazia', async () => {
    const { useCase } = await setup();

    const snapshot = await useCase.execute({ sourceId: 'sptrans', routeId: '477U-10' });

    expect(snapshot.vehicles).toEqual([]);
  });

  it('lança RealtimeDataNotReadyError antes do primeiro ciclo', async () => {
    const useCase = new GetVehicleSnapshotUseCase(new InMemoryPositionsStore());

    await expect(useCase.execute({ sourceId: 'sptrans', routeId: null })).rejects.toBeInstanceOf(
      RealtimeDataNotReadyError,
    );
  });
});
