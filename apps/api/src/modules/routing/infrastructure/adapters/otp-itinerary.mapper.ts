import type {
  Coordinates,
  Itinerary,
  Leg,
  LegPlace,
  TripMode,
} from '../../domain/entities/itinerary.entity';
import { legHeadsign } from '../../domain/value-objects/leg-headsign';
import { decodeGooglePolyline } from './google-polyline';
import type { OtpItinerary, OtpLeg, OtpLegTime, OtpPlace } from './otp.types';

// Enum Mode do OTP para TripMode. Modos raros caem no mais próximo do contrato.
const MODE_BY_OTP: Record<string, TripMode> = {
  WALK: 'walk',
  BUS: 'bus',
  COACH: 'bus',
  TROLLEYBUS: 'trolleybus',
  SUBWAY: 'subway',
  MONORAIL: 'subway',
  RAIL: 'rail',
  FUNICULAR: 'rail',
  TRAM: 'tram',
  CABLE_CAR: 'tram',
  GONDOLA: 'tram',
  FERRY: 'ferry',
};

const HEX_COLOR = /^[0-9A-Fa-f]{6}$/;

/** "1:875A-10" vira "875A-10": o OTP prefixa todo id GTFS com o id do feed. */
export function stripFeedPrefix(gtfsId: string): string {
  const separator = gtfsId.indexOf(':');
  return separator > 0 ? gtfsId.slice(separator + 1) : gtfsId;
}

export function tripModeFromOtp(mode: string | null, transitLeg: boolean): TripMode {
  const mapped = mode ? MODE_BY_OTP[mode.toUpperCase()] : undefined;
  return mapped ?? (transitLeg ? 'bus' : 'walk');
}

function legTime(time: OtpLegTime): string {
  return time.estimated?.time ?? time.scheduledTime;
}

function seconds(value: number | null, startAt: string, endAt: string): number {
  if (value !== null && Number.isFinite(value)) return Math.max(0, Math.round(value));
  return Math.max(0, Math.round((Date.parse(endAt) - Date.parse(startAt)) / 1000));
}

function legPlace(place: OtpPlace): LegPlace {
  return {
    name: place.name?.trim() || 'Ponto sem nome',
    location: { lat: place.lat, lon: place.lon },
    stopId: place.stop?.gtfsId ? stripFeedPrefix(place.stop.gtfsId) : null,
  };
}

function legPoints(leg: OtpLeg, from: Coordinates, to: Coordinates): Coordinates[] {
  const encoded = leg.legGeometry?.points;
  if (encoded) {
    try {
      const points = decodeGooglePolyline(encoded);
      if (points.length >= 2) return points;
    } catch {
      // Geometria corrompida: cai na reta entre as pontas.
    }
  }
  return [from, to];
}

function routeColor(color: string | null | undefined): string | null {
  const hex = color?.trim().replace(/^#/, '');
  return hex && HEX_COLOR.test(hex) ? hex.toUpperCase() : null;
}

export const OtpItineraryMapper = {
  toLeg(leg: OtpLeg): Leg {
    const transit = leg.transitLeg === true || (leg.route !== null && leg.mode !== 'WALK');
    const mode = tripModeFromOtp(leg.mode, transit);
    const isTransit = mode !== 'walk';
    const from = legPlace(leg.from);
    const to = legPlace(leg.to);
    const startAt = legTime(leg.start);
    const endAt = legTime(leg.end);
    const route = isTransit ? leg.route : null;
    return {
      mode,
      from,
      to,
      startAt,
      endAt,
      durationS: seconds(leg.duration, startAt, endAt),
      distanceM: Math.max(0, Math.round(leg.distance ?? 0)),
      routeId: route ? stripFeedPrefix(route.gtfsId) : null,
      routeShortName: route ? route.shortName?.trim() || route.longName?.trim() || null : null,
      routeColor: route ? routeColor(route.color) : null,
      headsign: isTransit
        ? legHeadsign(leg.headsign?.trim() || null, from.name, route?.longName?.trim() || null)
        : null,
      intermediateStops: isTransit ? (leg.intermediateStops ?? []).filter(Boolean).length : 0,
      isRealtime: isTransit && leg.realTime === true,
      points: legPoints(leg, from.location, to.location),
    };
  },

  /** null quando o OTP devolve itinerário sem trechos. */
  toDomain(node: OtpItinerary): Itinerary | null {
    const legs = node.legs
      .filter((leg): leg is OtpLeg => leg !== null)
      .map((leg) => OtpItineraryMapper.toLeg(leg));
    const first = legs[0];
    const last = legs[legs.length - 1];
    if (!first || !last) return null;

    const startAt = node.start ?? first.startAt;
    const endAt = node.end ?? last.endAt;
    const transitLegs = legs.filter((leg) => leg.mode !== 'walk').length;
    const walkDistance =
      node.walkDistance ??
      legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.distanceM, 0);
    return {
      startAt,
      endAt,
      durationS: seconds(node.duration, startAt, endAt),
      walkDistanceM: Math.max(0, Math.round(walkDistance)),
      transfers: Math.max(0, node.numberOfTransfers ?? transitLegs - 1),
      legs,
    };
  },
};
