import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../shared/domain/errors/domain-error';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { OlhoVivoClient } from '../../../../shared/infrastructure/olho-vivo/olho-vivo.client';
import type { Arrival } from '../../domain/entities/arrival.entity';
import { ArrivalsProvider } from '../../domain/ports/arrivals-provider.port';
import { OlhoVivoStopForecastSchema, toArrivals } from './olho-vivo-arrival.mapper';

const SOURCE = 'olho-vivo';
// Na SPTrans o stop_id do GTFS é o código `cp` da Olho Vivo, sempre numérico.
const OLHO_VIVO_STOP_CODE = /^\d+$/;

/** Previsão por parada via GET /Previsao/Parada; timeout, retry e re-login ficam no cliente. */
@Injectable()
export class OlhoVivoArrivalsAdapter extends ArrivalsProvider {
  constructor(private readonly client: OlhoVivoClient) {
    super();
  }

  async forStop(stopId: string): Promise<Arrival[]> {
    if (!OLHO_VIVO_STOP_CODE.test(stopId)) return [];

    let raw: unknown;
    try {
      raw = await this.client.get<unknown>('Previsao/Parada', { codigoParada: stopId });
    } catch (error) {
      if (error instanceof SourceUnavailableError) throw error;
      // Token ausente ou recusado, ou erro inesperado: para quem consulta, a fonte está fora.
      const cause = error instanceof DomainError ? `${error.code}: ${error.message}` : error;
      throw new SourceUnavailableError(SOURCE, undefined, { cause });
    }

    const parsed = OlhoVivoStopForecastSchema.safeParse(raw);
    if (!parsed.success) {
      throw new SourceUnavailableError(SOURCE, undefined, { cause: parsed.error });
    }
    return toArrivals(parsed.data, stopId, new Date());
  }
}
