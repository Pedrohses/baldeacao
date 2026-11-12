// Registros de um feed GTFS estático já normalizados (tipos certos, vazio vira null).
// Horários em segundos desde a meia-noite do dia de serviço; datas em AAAA-MM-DD.

export interface GtfsRoute {
  routeId: string;
  agencyId: string | null;
  shortName: string;
  longName: string;
  routeType: number;
  color: string | null;
  textColor: string | null;
}

export interface GtfsStop {
  stopId: string;
  code: string | null;
  name: string;
  description: string | null;
  lat: number;
  lon: number;
}

export interface GtfsTrip {
  tripId: string;
  routeId: string;
  serviceId: string;
  headsign: string | null;
  directionId: 0 | 1 | null;
  shapeId: string | null;
}

export interface GtfsStopTime {
  tripId: string;
  stopId: string;
  stopSequence: number;
  arrivalTime: number | null;
  departureTime: number | null;
}

export interface GtfsCalendar {
  serviceId: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: string;
  endDate: string;
}

export interface GtfsFrequency {
  tripId: string;
  startTime: number;
  endTime: number;
  headwaySecs: number;
}

export interface GtfsShapePoint {
  shapeId: string;
  lat: number;
  lon: number;
  sequence: number;
}

/** Traçado montado a partir dos pontos de shapes.txt, em ordem de sequência. */
export interface GtfsShape {
  shapeId: string;
  points: Array<{ lat: number; lon: number }>;
}

/**
 * Feed aberto para leitura em fluxo: cada arquivo é lido uma vez, sob demanda,
 * para não carregar o stop_times inteiro em memória.
 */
export interface GtfsFeed {
  routes(): AsyncIterable<GtfsRoute>;
  stops(): AsyncIterable<GtfsStop>;
  trips(): AsyncIterable<GtfsTrip>;
  stopTimes(): AsyncIterable<GtfsStopTime>;
  calendar(): AsyncIterable<GtfsCalendar>;
  frequencies(): AsyncIterable<GtfsFrequency>;
  shapes(): AsyncIterable<GtfsShape>;
}

/** Feed como vem do leitor: shapes ainda como pontos soltos. */
export interface RawGtfsFeed extends Omit<GtfsFeed, 'shapes'> {
  shapePoints(): AsyncIterable<GtfsShapePoint>;
}

export interface GtfsImportCounts {
  routes: number;
  stops: number;
  trips: number;
  stopTimes: number;
  calendar: number;
  frequencies: number;
  shapes: number;
}
