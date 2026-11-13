import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { Arrival } from '../../domain/entities/arrival.entity';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { ArrivalsCache } from '../../domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from '../../domain/ports/arrivals-provider.port';
import {
  InMemoryRouteRepository,
  InMemoryStopRepository,
} from '../../../../../test/support/transit-in-memory';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import { StopNotFoundError } from '../../domain/errors/stop-not-found.error';
import { ARRIVALS_CACHE_TTL_SECONDS, GetStopArrivalsUseCase } from './get-stop-arrivals.use-case';

const arrival = (vehicleId: string, expectedAt: string) =>
  new Arrival({
    stopId: '4301848',
    routeId: '875A-10',
    routeShortName: '875A-10',
    directionId: 0,
    headsign: 'AEROPORTO',
    vehicleId,
    expectedAt,
    isRealtime: true,
    accessible: true,
    vehicleLocation: { lat: -23.559, lon: -46.6612 },
  });

const late = arrival('2', '2026-11-12T12:44:00-03:00');
const soon = arrival('1', '2026-11-12T12:36:00-03:00');
// 875A-10 no recorte sptrans-mini: verde com texto branco.
const colored = (a: Arrival) => a.withRouteColors('509E2F', 'FFFFFF');

class BrokenRouteRepository extends InMemoryRouteRepository {
  override findById(): ReturnType<RouteRepository['findById']> {
    return Promise.reject(new Error('postgres fora'));
  }
}

class InMemoryArrivalsProvider extends ArrivalsProvider {
  calls = 0;
  constructor(private readonly result: Arrival[] | Error) {
    super();
  }
  forStop(): Promise<Arrival[]> {
    this.calls += 1;
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

class InMemoryArrivalsCache extends ArrivalsCache {
  readonly entries = new Map<string, { arrivals: Arrival[]; ttl: number }>();
  constructor(private readonly broken = false) {
    super();
  }
  get(stopId: string): Promise<Arrival[] | null> {
    if (this.broken) return Promise.reject(new Error('redis fora'));
    return Promise.resolve(this.entries.get(stopId)?.arrivals ?? null);
  }
  set(stopId: string, arrivals: Arrival[], ttl: number): Promise<void> {
    if (this.broken) return Promise.reject(new Error('redis fora'));
    this.entries.set(stopId, { arrivals, ttl });
    return Promise.resolve();
  }
}

describe('GetStopArrivalsUseCase', () => {
  it('busca na fonte, ordena por expectedAt e guarda no cache curto', async () => {
    const provider = new InMemoryArrivalsProvider([late, soon]);
    const cache = new InMemoryArrivalsCache();
    const useCase = new GetStopArrivalsUseCase(
      provider,
      cache,
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );

    const result = await useCase.execute({ stopId: '4301848' });

    expect(result).toEqual({ stopId: '4301848', arrivals: [colored(soon), colored(late)] });
    expect(cache.entries.get('4301848')).toEqual({
      arrivals: [colored(soon), colored(late)],
      ttl: ARRIVALS_CACHE_TTL_SECONDS,
    });
  });

  it('serve do cache sem chamar a fonte', async () => {
    const provider = new InMemoryArrivalsProvider([late]);
    const cache = new InMemoryArrivalsCache();
    const useCase = new GetStopArrivalsUseCase(
      provider,
      cache,
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );

    await useCase.execute({ stopId: '4301848' });
    await useCase.execute({ stopId: '4301848' });

    expect(provider.calls).toBe(1);
  });

  it('segue sem cache quando o Redis falha', async () => {
    const provider = new InMemoryArrivalsProvider([soon]);
    const useCase = new GetStopArrivalsUseCase(
      provider,
      new InMemoryArrivalsCache(true),
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );

    await expect(useCase.execute({ stopId: '4301848' })).resolves.toEqual({
      stopId: '4301848',
      arrivals: [colored(soon)],
    });
  });

  it('acrescenta a cor da linha (GTFS) à previsão', async () => {
    const useCase = new GetStopArrivalsUseCase(
      new InMemoryArrivalsProvider([soon]),
      new InMemoryArrivalsCache(),
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );

    const [first] = (await useCase.execute({ stopId: '4301848' })).arrivals;

    expect(first).toMatchObject({ routeColor: '509E2F', routeTextColor: 'FFFFFF' });
    expect(soon.routeColor).toBeNull();
  });

  it('linha fora da rede planejada fica sem cor', async () => {
    const useCase = new GetStopArrivalsUseCase(
      new InMemoryArrivalsProvider([soon]),
      new InMemoryArrivalsCache(),
      new InMemoryStopRepository(),
      new InMemoryRouteRepository([]),
    );

    const [first] = (await useCase.execute({ stopId: '4301848' })).arrivals;

    expect(first).toMatchObject({ routeColor: null, routeTextColor: null });
  });

  it('segue sem cor quando a rede planejada falha', async () => {
    const useCase = new GetStopArrivalsUseCase(
      new InMemoryArrivalsProvider([soon]),
      new InMemoryArrivalsCache(),
      new InMemoryStopRepository(),
      new BrokenRouteRepository(),
    );

    await expect(useCase.execute({ stopId: '4301848' })).resolves.toEqual({
      stopId: '4301848',
      arrivals: [soon],
    });
  });

  it('propaga SourceUnavailableError e não grava cache', async () => {
    const cache = new InMemoryArrivalsCache();
    const useCase = new GetStopArrivalsUseCase(
      new InMemoryArrivalsProvider(new SourceUnavailableError('olho-vivo')),
      cache,
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );

    await expect(useCase.execute({ stopId: '4301848' })).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
    expect(cache.entries.size).toBe(0);
  });

  it('recusa parada vazia', async () => {
    const useCase = new GetStopArrivalsUseCase(
      new InMemoryArrivalsProvider([]),
      new InMemoryArrivalsCache(),
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );
    await expect(useCase.execute({ stopId: '  ' })).rejects.toBeInstanceOf(
      InvalidTransitQueryError,
    );
  });

  it('parada que não existe no GTFS vira StopNotFoundError sem consultar a fonte', async () => {
    const provider = new InMemoryArrivalsProvider([]);
    const useCase = new GetStopArrivalsUseCase(
      provider,
      new InMemoryArrivalsCache(),
      new InMemoryStopRepository(),
      new InMemoryRouteRepository(),
    );
    await expect(useCase.execute({ stopId: 'nope123' })).rejects.toBeInstanceOf(StopNotFoundError);
  });
});
