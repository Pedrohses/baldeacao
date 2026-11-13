import { Injectable } from '@nestjs/common';
import type { GtfsShape, RawGtfsFeed } from '../../domain/entities/gtfs-feed.entity';
import { assembleShapes } from '../../domain/services/assemble-shapes';
import {
  isRailRouteType,
  repairShapes,
  type ShapeRepairAction,
  type ShapeUsage,
} from '../../domain/services/repair-shapes';
import type { LatLon } from '../../domain/services/shape-geometry';

export interface RepairedGtfsShapes {
  shapes: GtfsShape[];
  /** shape_id com menos de dois pontos: não formam traçado e ficam de fora. */
  skipped: string[];
  actions: ShapeRepairAction[];
}

/**
 * Monta os traçados do feed e corrige os defeitos conhecidos (espinhos, saltos e pontas),
 * usando rotas, viagens e paradas para saber o modo e onde cada viagem começa e termina.
 * Usado pela importação no Postgres e pela preparação do zip do OTP: os dois veem o mesmo traçado.
 */
@Injectable()
export class RepairGtfsShapesUseCase {
  async execute(feed: RawGtfsFeed): Promise<RepairedGtfsShapes> {
    const { shapes, skipped } = await assembleShapes(feed.shapePoints());
    const usage = await collectUsage(feed);
    const { shapes: repaired, actions } = repairShapes(shapes, usage);
    return { shapes: repaired, skipped, actions };
  }
}

interface TripEnds {
  first: { sequence: number; stopId: string } | null;
  last: { sequence: number; stopId: string } | null;
}

async function collectUsage(feed: RawGtfsFeed): Promise<Map<string, ShapeUsage>> {
  const routeTypes = new Map<string, number>();
  for await (const route of feed.routes()) routeTypes.set(route.routeId, route.routeType);

  const shapeOfTrip = new Map<string, string>();
  const shapeInfo = new Map<string, { rail: boolean; routeType: number; trips: string[] }>();
  for await (const trip of feed.trips()) {
    if (!trip.shapeId) continue;
    shapeOfTrip.set(trip.tripId, trip.shapeId);
    const routeType = routeTypes.get(trip.routeId) ?? 3;
    const info = shapeInfo.get(trip.shapeId);
    if (info) {
      info.rail ||= isRailRouteType(routeType);
      info.trips.push(trip.tripId);
    } else {
      shapeInfo.set(trip.shapeId, {
        rail: isRailRouteType(routeType),
        routeType,
        trips: [trip.tripId],
      });
    }
  }

  // stop_times em fluxo: guarda só a primeira e a última parada de cada viagem com traçado.
  const ends = new Map<string, TripEnds>();
  for await (const stopTime of feed.stopTimes()) {
    if (!shapeOfTrip.has(stopTime.tripId)) continue;
    let trip = ends.get(stopTime.tripId);
    if (!trip) {
      trip = { first: null, last: null };
      ends.set(stopTime.tripId, trip);
    }
    const entry = { sequence: stopTime.stopSequence, stopId: stopTime.stopId };
    if (!trip.first || entry.sequence < trip.first.sequence) trip.first = entry;
    if (!trip.last || entry.sequence > trip.last.sequence) trip.last = entry;
  }

  const wanted = new Set<string>();
  for (const trip of ends.values()) {
    if (trip.first) wanted.add(trip.first.stopId);
    if (trip.last) wanted.add(trip.last.stopId);
  }
  const stops = new Map<string, LatLon>();
  for await (const stop of feed.stops()) {
    if (wanted.has(stop.stopId)) stops.set(stop.stopId, { lat: stop.lat, lon: stop.lon });
  }

  const usage = new Map<string, ShapeUsage>();
  for (const [shapeId, info] of shapeInfo) {
    const tripEnds = info.trips.flatMap((tripId) => {
      const trip = ends.get(tripId);
      // Viagem de uma parada só não diz onde o traçado começa nem termina.
      return trip?.first && trip.last && trip.first.sequence !== trip.last.sequence ? [trip] : [];
    });
    usage.set(shapeId, {
      rail: info.rail,
      routeType: info.routeType,
      firstStop: agreedStop(
        tripEnds.map((trip) => trip.first?.stopId),
        stops,
      ),
      lastStop: agreedStop(
        tripEnds.map((trip) => trip.last?.stopId),
        stops,
      ),
    });
  }
  return usage;
}

/** Parada comum a todas as viagens do traçado; se divergem, a ponta fica como está. */
function agreedStop(
  stopIds: Array<string | undefined>,
  stops: ReadonlyMap<string, LatLon>,
): LatLon | null {
  const distinct = new Set(stopIds);
  if (distinct.size !== 1) return null;
  const [stopId] = distinct;
  return stopId === undefined ? null : (stops.get(stopId) ?? null);
}
