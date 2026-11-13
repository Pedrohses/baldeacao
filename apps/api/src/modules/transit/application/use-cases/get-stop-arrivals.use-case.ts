import { Injectable, Logger } from '@nestjs/common';
import type { Arrival } from '../../domain/entities/arrival.entity';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { ArrivalsCache } from '../../domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from '../../domain/ports/arrivals-provider.port';
import { RouteRepository } from '../../domain/ports/route-repository.port';
import { StopRepository } from '../../domain/ports/stop-repository.port';
import { StopNotFoundError } from '../../domain/errors/stop-not-found.error';
import type { GetStopArrivalsInput, GetStopArrivalsOutput } from '../dto/stop-arrivals.dto';

/** A Olho Vivo recalcula a previsão a cada ciclo de posições (~30 s); 20 s mantém o dado fresco. */
export const ARRIVALS_CACHE_TTL_SECONDS = 20;

@Injectable()
export class GetStopArrivalsUseCase {
  private readonly logger = new Logger(GetStopArrivalsUseCase.name);

  constructor(
    private readonly provider: ArrivalsProvider,
    private readonly cache: ArrivalsCache,
    private readonly stops: StopRepository,
    private readonly routes: RouteRepository,
  ) {}

  async execute(input: GetStopArrivalsInput): Promise<GetStopArrivalsOutput> {
    const stopId = input.stopId.trim();
    if (stopId.length === 0) throw new InvalidTransitQueryError('Informe a parada.');

    // Cache é atalho, não dependência: se o Redis cair, a previsão sai direto da fonte.
    const cached = await this.cache.get(stopId).catch((error: unknown) => {
      this.logger.warn(`Cache de previsão indisponível: ${describe(error)}`);
      return null;
    });
    if (cached) return { stopId, arrivals: sortByExpectedAt(cached) };

    // Parada que não existe no GTFS: erro claro em vez de lista vazia da Olho Vivo.
    if (!(await this.stops.exists(stopId))) throw new StopNotFoundError(stopId);

    const arrivals = await this.withRouteColors(
      sortByExpectedAt(await this.provider.forStop(stopId)),
    );
    await this.cache.set(stopId, arrivals, ARRIVALS_CACHE_TTL_SECONDS).catch((error: unknown) => {
      this.logger.warn(`Falha ao gravar previsão no cache: ${describe(error)}`);
    });
    return { stopId, arrivals };
  }

  /**
   * A previsão em tempo real não traz a cor da linha: ela vem da rede planejada (GTFS). Uma
   * consulta por linha distinta (poucas por parada). Sem a rede, a previsão sai sem cor.
   */
  private async withRouteColors(arrivals: Arrival[]): Promise<Arrival[]> {
    const routeIds = [...new Set(arrivals.map((arrival) => arrival.routeId))];
    const colors = new Map<string, { color: string | null; textColor: string | null }>();
    try {
      const routes = await Promise.all(routeIds.map((id) => this.routes.findById(id)));
      for (const route of routes) {
        if (route) colors.set(route.id, { color: route.color, textColor: route.textColor });
      }
    } catch (error: unknown) {
      this.logger.warn(`Cores das linhas indisponíveis: ${describe(error)}`);
      return arrivals;
    }
    return arrivals.map((arrival) => {
      const found = colors.get(arrival.routeId);
      return found ? arrival.withRouteColors(found.color, found.textColor) : arrival;
    });
  }
}

function sortByExpectedAt(arrivals: Arrival[]): Arrival[] {
  return [...arrivals].sort((a, b) => a.expectedAtMs - b.expectedAtMs);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
