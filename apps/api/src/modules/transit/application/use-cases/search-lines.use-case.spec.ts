import { InMemoryRouteRepository, route875A } from '../../../../../test/support/transit-in-memory';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { SearchLinesUseCase } from './search-lines.use-case';

describe('SearchLinesUseCase', () => {
  it('busca pelo texto aparado com o limite padrão', async () => {
    const repo = new InMemoryRouteRepository();
    const result = await new SearchLinesUseCase(repo).execute({ text: '  875a ' });

    expect(result.lines).toEqual([route875A]);
    expect(repo.calls).toEqual([{ text: '875a', limit: 20 }]);
  });

  it('limita o tamanho da página', async () => {
    const repo = new InMemoryRouteRepository();
    await new SearchLinesUseCase(repo).execute({ text: 'term', limit: 500 });
    await new SearchLinesUseCase(repo).execute({ text: 'term', limit: 0 });
    expect(repo.calls.map((c) => c.limit)).toEqual([50, 1]);
  });

  it('recusa texto com menos de 2 caracteres', async () => {
    const repo = new InMemoryRouteRepository();
    await expect(new SearchLinesUseCase(repo).execute({ text: ' 8 ' })).rejects.toThrow(
      InvalidTransitQueryError,
    );
    expect(repo.calls).toEqual([]);
  });
});
