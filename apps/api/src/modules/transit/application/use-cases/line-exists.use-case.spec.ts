import {
  InMemoryRouteRepository,
  InMemoryServiceCalendar,
} from '../../../../../test/support/transit-in-memory';
import { GetServicePeriodUseCase } from './get-service-period.use-case';
import { LineExistsUseCase } from './line-exists.use-case';

describe('LineExistsUseCase', () => {
  const useCase = new LineExistsUseCase(new InMemoryRouteRepository());

  it('código completo existe', async () => {
    expect(await useCase.execute({ routeId: '875A-10' })).toEqual({
      exists: true,
      suggestions: [],
    });
  });

  it('só o número sugere o código completo; texto qualquer não existe', async () => {
    expect(await useCase.execute({ routeId: '875a' })).toEqual({
      exists: false,
      suggestions: ['875A-10'],
    });
    expect(await useCase.execute({ routeId: 'XYZ9-99' })).toEqual({
      exists: false,
      suggestions: [],
    });
    expect(await useCase.execute({ routeId: '  ' })).toEqual({ exists: false, suggestions: [] });
  });
});

describe('GetServicePeriodUseCase', () => {
  it('devolve a validade do calendário ou null sem GTFS', async () => {
    expect(await new GetServicePeriodUseCase(new InMemoryServiceCalendar()).execute()).toEqual({
      period: { startDate: '2026-01-01', endDate: '2026-12-31' },
    });
    expect(await new GetServicePeriodUseCase(new InMemoryServiceCalendar(null)).execute()).toEqual({
      period: null,
    });
  });
});
