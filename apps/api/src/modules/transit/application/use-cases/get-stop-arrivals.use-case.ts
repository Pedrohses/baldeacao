import { Injectable, Logger } from '@nestjs/common';
import type { Arrival } from '../../domain/entities/arrival.entity';
import { InvalidTransitQueryError } from '../../domain/errors/invalid-transit-query.error';
import { ArrivalsCache } from '../../domain/ports/arrivals-cache.port';
import { ArrivalsProvider } from '../../domain/ports/arrivals-provider.port';
import type { GetStopArrivalsInput, GetStopArrivalsOutput } from '../dto/stop-arrivals.dto';

/** A Olho Vivo recalcula a previsão a cada ciclo de posições (~30 s); 20 s mantém o dado fresco. */
export const ARRIVALS_CACHE_TTL_SECONDS = 20;

@Injectable()
export class GetStopArrivalsUseCase {
  private readonly logger = new Logger(GetStopArrivalsUseCase.name);

  constructor(
    private readonly provider: ArrivalsProvider,
    private readonly cache: ArrivalsCache,
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

    const arrivals = sortByExpectedAt(await this.provider.forStop(stopId));
    await this.cache.set(stopId, arrivals, ARRIVALS_CACHE_TTL_SECONDS).catch((error: unknown) => {
      this.logger.warn(`Falha ao gravar previsão no cache: ${describe(error)}`);
    });
    return { stopId, arrivals };
  }
}

function sortByExpectedAt(arrivals: Arrival[]): Arrival[] {
  return [...arrivals].sort((a, b) => a.expectedAtMs - b.expectedAtMs);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
