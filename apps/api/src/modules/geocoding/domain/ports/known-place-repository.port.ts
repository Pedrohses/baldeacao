import type { Coordinates, Place } from '../entities/place.entity';

/** Lugar conhecido achado pelo nome, com a importância da categoria. */
export interface KnownPlaceMatch {
  place: Place;
  importance: number;
}

/** Lugar conhecido a ser gravado pela importação (geometria em GeoJSON; área vira centroide). */
export interface KnownPlaceRecord {
  /** "osm:way:123", mesmo formato do id do Nominatim. */
  id: string;
  name: string;
  category: string;
  importance: number;
  address: string | null;
  suburb: string | null;
  city: string | null;
  geometryGeoJson: string;
}

/** Lugares conhecidos do OSM (parques, museus, hospitais...) guardados localmente. */
export abstract class KnownPlaceRepository {
  /**
   * Lugares cujo nome contém `text` (sem acento nem caixa, tolerando erro de digitação),
   * prefixo e início de palavra primeiro, depois maior importância e nome mais curto.
   */
  abstract searchByName(text: string, limit: number): Promise<KnownPlaceMatch[]>;

  /** Lugar mais próximo de `center` a até `radiusM` metros, ou null. */
  abstract findNearest(
    center: Coordinates,
    radiusM: number,
  ): Promise<{ place: Place; distanceM: number } | null>;

  /** Substitui todos os lugares numa única transação; devolve quantos ficaram gravados. */
  abstract replaceAll(records: KnownPlaceRecord[]): Promise<number>;
}
