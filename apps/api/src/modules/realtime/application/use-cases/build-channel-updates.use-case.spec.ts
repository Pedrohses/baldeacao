import { PositionsUpdateSchema, positionsLineChannel } from '@baldeacao/types';
import {
  InMemoryPositionsStore,
  rawPositionsFixture,
} from '../../../../../test/realtime/in-memory-realtime';
import { mapOlhoVivoPositions } from '../../infrastructure/adapters/olho-vivo-position.mapper';
import { BuildChannelUpdatesUseCase } from './build-channel-updates.use-case';

const UPDATED_AT = '2026-11-12T15:34:30.000Z';

async function filledStore(): Promise<InMemoryPositionsStore> {
  const store = new InMemoryPositionsStore();
  await store.replace(
    'sptrans',
    mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans'),
    UPDATED_AT,
  );
  return store;
}

describe('BuildChannelUpdatesUseCase', () => {
  it('monta a foto completa de cada canal no formato do contrato', async () => {
    const useCase = new BuildChannelUpdatesUseCase(await filledStore());

    const updates = await useCase.execute({
      sourceId: 'sptrans',
      channels: ['positions:all', positionsLineChannel('875A-10'), positionsLineChannel('477U-10')],
    });

    for (const update of updates) expect(PositionsUpdateSchema.parse(update)).toEqual(update);
    const [all, line875, line477] = updates;
    expect(all).toMatchObject({ channel: 'positions:all', routeId: null, updatedAt: UPDATED_AT });
    expect(all?.vehicles).toHaveLength(4);
    expect(line875).toMatchObject({ channel: 'positions:line:875A-10', routeId: '875A-10' });
    expect(line875?.vehicles).toHaveLength(3);
    expect(line477?.vehicles).toEqual([]);
  });

  it('não publica nada antes do primeiro ciclo ou sem canais', async () => {
    const empty = new BuildChannelUpdatesUseCase(new InMemoryPositionsStore());
    const filled = new BuildChannelUpdatesUseCase(await filledStore());

    await expect(
      empty.execute({ sourceId: 'sptrans', channels: ['positions:all'] }),
    ).resolves.toEqual([]);
    await expect(filled.execute({ sourceId: 'sptrans', channels: [] })).resolves.toEqual([]);
  });
});
