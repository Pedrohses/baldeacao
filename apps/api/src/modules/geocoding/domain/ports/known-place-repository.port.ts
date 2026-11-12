import type { Coordinates, Place } from '../entities/place.entity';

/** Lugar conhecido achado pelo nome, com o que a ordenação da busca usa. */
export interface KnownPlaceMatch {
  place: Place;
  importance: number;
  /** Tag que classificou, ex.: "aeroway=aerodrome". */
  category: string;
  /** Nomes alternativos (alt_name, short_name, official_name, old_name, loc_name). */
  aliases: string[];
  /** Dentro do município atendido; null quando o limite não foi importado. */
  inCity: boolean | null;
}

/** Lugar conhecido a ser gravado pela importação (geometria em GeoJSON; área vira centroide). */
export interface KnownPlaceRecord {
  /** "osm:way:123", mesmo formato do id do Nominatim. */
  id: string;
  name: string;
  category: string;
  /** "poi", "station" (estação de metrô/trem) ou "address" (bairro). */
  kind: 'poi' | 'station' | 'address';
  importance: number;
  aliases: string[];
  address: string | null;
  suburb: string | null;
  city: string | null;
  geometryGeoJson: string;
}

/** Lugares conhecidos do OSM (parques, museus, hospitais...) guardados localmente. */
export abstract class KnownPlaceRepository {
  /**
   * Lugares cujo nome ou nome alternativo contém `text` (sem acento nem caixa, tolerando erro
   * de digitação): nome igual, prefixo e início de palavra primeiro, depois dentro do
   * município, maior importância e mais perto do centro. A ordem final sai de rankPlaces.
   */
  abstract searchByName(text: string, limit: number): Promise<KnownPlaceMatch[]>;

  /** Lugar mais próximo de `center` a até `radiusM` metros, ou null. */
  abstract findNearest(
    center: Coordinates,
    radiusM: number,
  ): Promise<{ place: Place; distanceM: number } | null>;

  /**
   * Para cada ponto, se fica dentro do município atendido; null quando o limite do município
   * não foi importado.
   */
  abstract inServiceCity(points: Coordinates[]): Promise<Array<boolean | null>>;

  /**
   * Substitui todos os lugares e o limite do município atendido (GeoJSON, null mantém sem
   * limite) numa única transação; devolve quantos lugares ficaram gravados.
   */
  abstract replaceAll(
    records: KnownPlaceRecord[],
    cityBoundaryGeoJson: string | null,
  ): Promise<number>;
}
