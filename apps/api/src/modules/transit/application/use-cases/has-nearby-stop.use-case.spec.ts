import { InMemoryStopRepository } from '../../../../../test/support/transit-in-memory';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { HasNearbyStopUseCase } from './has-nearby-stop.use-case';

describe('HasNearbyStopUseCase', () => {
  const useCase = new HasNearbyStopUseCase(new InMemoryStopRepository());

  it('diz se há parada a até o raio', async () => {
    expect(
      await useCase.execute({ center: { lat: -23.565, lon: -46.6559 }, radiusM: 1000 }),
    ).toEqual({ hasStop: true });
    expect(await useCase.execute({ center: { lat: -24.2, lon: -46.6559 }, radiusM: 1000 })).toEqual(
      {
        hasStop: false,
      },
    );
  });

  it('recusa coordenada ou raio inválidos', async () => {
    await expect(
      useCase.execute({ center: { lat: 91, lon: 0 }, radiusM: 1000 }),
    ).rejects.toBeInstanceOf(InvalidTransitQueryError);
    await expect(
      useCase.execute({ center: { lat: -23.5, lon: -46.6 }, radiusM: 0 }),
    ).rejects.toBeInstanceOf(InvalidTransitQueryError);
  });
});
