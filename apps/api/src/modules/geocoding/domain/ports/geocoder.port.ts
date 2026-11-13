import type { Coordinates, Place } from '../entities/place.entity';

/** Fonte externa de geocodificação (texto livre para lugares). */
export abstract class Geocoder {
  /**
   * Até `limit` lugares para o texto, do mais relevante ao menos relevante.
   * Falha da fonte vira SourceUnavailableError.
   */
  abstract search(query: string, limit: number): Promise<Place[]>;

  /**
   * Trechos de rua com o nome dado na cidade atendida (para achar esquinas). Padrão: a busca
   * por texto livre; o Nominatim usa a busca estruturada por `street`.
   */
  searchStreet(street: string, limit: number): Promise<Place[]> {
    return this.search(street, limit);
  }

  /** Lugar (endereço ou ponto de interesse) mais próximo do ponto; null quando não há. */
  abstract reverse(location: Coordinates): Promise<Place | null>;
}
