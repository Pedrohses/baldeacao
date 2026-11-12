import type { Place } from '../entities/place.entity';

/** Cache persistente de buscas de lugar, pela consulta normalizada. */
export abstract class GeocodeCache {
  /** Resultado guardado e ainda válido; null quando não há ou já expirou. */
  abstract get(key: string): Promise<Place[] | null>;

  /** Guarda (ou substitui) o resultado de `key` por `ttlSeconds`. */
  abstract set(key: string, query: string, places: Place[], ttlSeconds: number): Promise<void>;
}
