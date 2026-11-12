import {
  InMemoryRouteRepository,
  route8000,
  route875A,
  shape875A0,
} from '../../../../../test/support/transit-in-memory';
import { LineShape } from '../../domain/entities/line-shape.entity';
import { LineNotFoundError } from '../../domain/errors/line-not-found.error';
import { GetLineDetailsUseCase } from './get-line-details.use-case';

describe('GetLineDetailsUseCase', () => {
  it('devolve a linha com o traçado de cada sentido', async () => {
    const useCase = new GetLineDetailsUseCase(new InMemoryRouteRepository());
    await expect(useCase.execute({ routeId: '875A-10' })).resolves.toEqual({
      line: route875A,
      shapes: [shape875A0],
    });
  });

  it('devolve lista vazia quando a linha não tem traçado e descarta traçado degenerado', async () => {
    const degenerate = new LineShape({
      routeId: '8000-10',
      sourceId: 'sptrans',
      directionId: 1,
      shapeId: 'x',
      points: [{ lat: -23.5, lon: -46.6 }],
    });
    const useCase = new GetLineDetailsUseCase(
      new InMemoryRouteRepository([route8000], [degenerate]),
    );
    await expect(useCase.execute({ routeId: '8000-10' })).resolves.toEqual({
      line: route8000,
      shapes: [],
    });
  });

  it('lança LineNotFoundError para id desconhecido', async () => {
    const useCase = new GetLineDetailsUseCase(new InMemoryRouteRepository());
    await expect(useCase.execute({ routeId: '9999-10' })).rejects.toThrow(LineNotFoundError);
  });
});
