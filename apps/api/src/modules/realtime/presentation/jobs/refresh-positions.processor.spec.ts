import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  FixedClock,
  InMemoryCycleNotifier,
  InMemoryPositionsSource,
  InMemoryPositionsStore,
} from '../../../../../test/realtime/in-memory-realtime';
import { OlhoVivoAuthError } from '../../../../shared/domain/errors/olho-vivo-auth.error';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { RefreshVehiclePositionsUseCase } from '../../application/use-cases/refresh-vehicle-positions.use-case';
import { REFRESH_POSITIONS_JOB, type RefreshPositionsJobData } from './realtime-queue';
import { RefreshPositionsProcessor } from './refresh-positions.processor';

const job = {
  name: REFRESH_POSITIONS_JOB,
  data: { sourceId: 'sptrans' },
} as Job<RefreshPositionsJobData>;

function setup(result: ConstructorParameters<typeof InMemoryPositionsSource>[0]) {
  const store = new InMemoryPositionsStore();
  const useCase = new RefreshVehiclePositionsUseCase(
    new InMemoryPositionsSource(result),
    store,
    new InMemoryCycleNotifier(),
    new FixedClock(),
  );
  return { store, processor: new RefreshPositionsProcessor(useCase) };
}

describe('RefreshPositionsProcessor', () => {
  let error: jest.SpyInstance;
  let warn: jest.SpyInstance;

  beforeEach(() => {
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('roda o ciclo e devolve o evento', async () => {
    const { processor, store } = setup([]);

    await expect(processor.process(job)).resolves.toMatchObject({ vehicleCount: 0 });
    expect((await store.read('sptrans')).updatedAt).not.toBeNull();
  });

  it('token recusado vira log e o job termina sem lançar', async () => {
    const { processor, store } = setup(new OlhoVivoAuthError());

    await expect(processor.process(job)).resolves.toBeNull();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('OLHO_VIVO_AUTH_FAILED'));
    expect((await store.read('sptrans')).updatedAt).toBeNull();
  });

  it('fonte fora vira aviso e o job termina sem lançar', async () => {
    const { processor } = setup(new SourceUnavailableError('olho-vivo'));

    await expect(processor.process(job)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('SOURCE_UNAVAILABLE'));
  });

  it('erro inesperado falha o job', async () => {
    const { processor } = setup(new Error('bug'));

    await expect(processor.process(job)).rejects.toThrow('bug');
  });
});
