export interface Coordinates {
  lat: number;
  lon: number;
}

/** Modo de um trecho: caminhada ou o tipo de veículo (como RouteType do GTFS). */
export type TripMode = 'walk' | 'bus' | 'trolleybus' | 'subway' | 'rail' | 'tram' | 'ferry';

export interface LegPlace {
  name: string;
  location: Coordinates;
  /** stop_id do GTFS (sem prefixo de feed) quando o ponto é uma parada. */
  stopId: string | null;
}

/** Trecho do itinerário. Campos de linha são null na caminhada. */
export interface Leg {
  mode: TripMode;
  from: LegPlace;
  to: LegPlace;
  /** ISO 8601 com fuso. */
  startAt: string;
  endAt: string;
  durationS: number;
  distanceM: number;
  routeId: string | null;
  routeShortName: string | null;
  routeColor: string | null;
  headsign: string | null;
  intermediateStops: number;
  isRealtime: boolean;
  /** Geometria decodificada, pelo menos dois pontos. */
  points: Coordinates[];
}

/** Uma opção de viagem de A até B. */
export interface Itinerary {
  startAt: string;
  endAt: string;
  durationS: number;
  walkDistanceM: number;
  /** Baldeações. */
  transfers: number;
  legs: Leg[];
  /** Saídas seguintes com os mesmos trechos (mesmas linhas), ISO 8601; ausente quando não há. */
  alsoDepartsAt?: string[];
}
