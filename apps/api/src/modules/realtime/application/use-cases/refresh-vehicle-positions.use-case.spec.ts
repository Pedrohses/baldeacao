import {
  FixedClock,
  InMemoryCycleNotifier,
  InMemoryPositionsSource,
  InMemoryPositionsStore,
  rawPositionsFixture,
} from '../../../../../test/realtime/in-memory-realtime';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { mapOlhoVivoPositions } from '../../infrastructure/adapters/olho-vivo-position.mapper';
import { RefreshVehiclePositionsUseCase } from './refresh-vehicle-positions.use-case';

function setup(result = mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans')) {
  const source = new InMemoryPositionsSource(result);
  const store = new InMemoryPositionsStore();
  const notifier = new InMemoryCycleNotifier();
  const clock = new FixedClock();
  const useCase = new RefreshVehiclePositionsUseCase(source, store, notifier, clock);
  return { source, store, notifier, clock, useCase };
}

describe('RefreshVehiclePositionsUseCase', () => {
  it('grava a foto com updated_at do ciclo e avisa o gateway', async () => {
    const { store, notifier, useCase } = setup();

    const event = await useCase.execute();

    expect(event).toEqual({
      sourceId: 'sptrans',
      updatedAt: '2026-11-12T15:34:30.000Z',
      vehicleCount: 4,
    });
    const stored = await store.read('sptrans');
    expect(stored.updatedAt).toBe('2026-11-12T15:34:30.000Z');
    expect(stored.vehicles).toHaveLength(4);
    expect(notifier.published).toEqual([event]);
  });

  it('não grava nem avisa quando a fonte falha, mantendo o último dado bom', async () => {
    const { source, store, notifier, clock, useCase } = setup();
    await useCase.execute();

    source.result = new SourceUnavailableError('olho-vivo');
    clock.current = new Date('2026-11-12T15:35:00.000Z');

    await expect(useCase.execute()).rejects.toBeInstanceOf(SourceUnavailableError);
    expect((await store.read('sptrans')).updatedAt).toBe('2026-11-12T15:34:30.000Z');
    expect(notifier.published).toHaveLength(1);
  });
});
