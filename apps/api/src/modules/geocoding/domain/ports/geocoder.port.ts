import type { Place } from '../entities/place.entity';

/** Fonte externa de geocodificação (texto livre para lugares). */
export abstract class Geocoder {
  /**
   * Até `limit` lugares para o texto, do mais relevante ao menos relevante.
   * Falha da fonte vira SourceUnavailableError.
   */
  abstract search(query: string, limit: number): Promise<Place[]>;
}
