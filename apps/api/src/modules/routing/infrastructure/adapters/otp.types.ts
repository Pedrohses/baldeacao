// Resposta de OTP_PLAN_CONNECTION_QUERY (OTP 2.10, API GraphQL GTFS), só os campos pedidos.

export interface OtpLegTime {
  scheduledTime: string;
  estimated: { time: string } | null;
}

export interface OtpPlace {
  name: string | null;
  lat: number;
  lon: number;
  stop: { gtfsId: string } | null;
}

export interface OtpLeg {
  /** Enum Mode do OTP: WALK, BUS, RAIL, SUBWAY, TRAM, FERRY, TROLLEYBUS, MONORAIL... */
  mode: string | null;
  transitLeg: boolean | null;
  realTime: boolean | null;
  duration: number | null;
  distance: number | null;
  headsign: string | null;
  start: OtpLegTime;
  end: OtpLegTime;
  from: OtpPlace;
  to: OtpPlace;
  route: {
    gtfsId: string;
    shortName: string | null;
    longName: string | null;
    color: string | null;
  } | null;
  intermediateStops: Array<{ gtfsId: string } | null> | null;
  legGeometry: { points: string | null } | null;
}

export interface OtpItinerary {
  start: string | null;
  end: string | null;
  duration: number | null;
  walkDistance: number | null;
  numberOfTransfers: number;
  legs: Array<OtpLeg | null>;
}

export interface OtpPlanConnectionResponse {
  data?: {
    planConnection: {
      routingErrors: Array<{ code: string; description: string }>;
      edges: Array<{ node: OtpItinerary } | null> | null;
    } | null;
  } | null;
  errors?: Array<{ message: string }>;
}
