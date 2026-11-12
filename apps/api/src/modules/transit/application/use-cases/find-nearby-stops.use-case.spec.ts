import {
  InMemoryStopRepository,
  stopLiberdade,
  stopPaulista,
} from '../../../../../test/support/transit-in-memory';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { FindNearbyStopsUseCase } from './find-nearby-stops.use-case';

describe('FindNearbyStopsUseCase', () => {
  const useCase = new FindNearbyStopsUseCase(new InMemoryStopRepository());

  it('usa 500 m como raio padrão', async () => {
    const { stops } = await useCase.execute({ center: stopPaulista.location });
    expect(stops).toEqual([{ stop: stopPaulista, distanceM: 0 }]);
  });

  it('ordena da mais próxima para a mais distante e respeita o raio', async () => {
    // Centro entre as duas: Liberdade a ~1007 m, Paulista a ~1143 m.
    const center = { lat: -23.559, lon: -46.645 };
    const { stops } = await useCase.execute({ center, radiusM: 2000 });
    expect(stops.map((s) => s.stop)).toEqual([stopLiberdade, stopPaulista]);
    expect(stops[0]!.distanceM).toBeLessThan(stops[1]!.distanceM);

    const near = await useCase.execute({ center: stopLiberdade.location, radiusM: 1000 });
    expect(near.stops.map((s) => s.stop)).toEqual([stopLiberdade]);
  });

  it.each([0, -1, 2001, Number.NaN])('recusa raio %p', async (radiusM) => {
    await expect(useCase.execute({ center: stopPaulista.location, radiusM })).rejects.toThrow(
      InvalidTransitQueryError,
    );
  });

  it('recusa coordenada fora do globo', async () => {
    await expect(useCase.execute({ center: { lat: 91, lon: 0 } })).rejects.toThrow(
      InvalidTransitQueryError,
    );
  });
});
