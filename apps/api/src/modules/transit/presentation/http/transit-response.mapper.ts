import type {
  Arrival as ArrivalDto,
  LineShape as LineShapeDto,
  NearbyStop as NearbyStopDto,
  Route as RouteDto,
  Stop as StopDto,
} from '@baldeacao/types';
import type { Arrival } from '../../domain/entities/arrival.entity';
import type { LineShape } from '../../domain/entities/line-shape.entity';
import type { Route } from '../../domain/entities/route.entity';
import type { NearbyStop, Stop } from '../../domain/entities/stop.entity';

// Domínio para o contrato HTTP v1 (packages/types). Campos listados um a um de propósito:
// o que não está no contrato não vaza para a resposta.
export const TransitResponseMapper = {
  route(route: Route): RouteDto {
    return {
      id: route.id,
      sourceId: route.sourceId,
      shortName: route.shortName,
      longName: route.longName,
      type: route.type,
      color: route.color,
      textColor: route.textColor,
    };
  },

  stop(stop: Stop): StopDto {
    return {
      id: stop.id,
      sourceId: stop.sourceId,
      code: stop.code,
      name: stop.name,
      description: stop.description,
      location: { lat: stop.location.lat, lon: stop.location.lon },
    };
  },

  nearbyStop({ stop, distanceM }: NearbyStop): NearbyStopDto {
    return { ...TransitResponseMapper.stop(stop), distanceM };
  },

  lineShape(shape: LineShape): LineShapeDto {
    return {
      routeId: shape.routeId,
      sourceId: shape.sourceId,
      directionId: shape.directionId,
      shapeId: shape.shapeId,
      points: shape.points.map(({ lat, lon }) => ({ lat, lon })),
    };
  },

  arrival(arrival: Arrival): ArrivalDto {
    return {
      stopId: arrival.stopId,
      routeId: arrival.routeId,
      routeShortName: arrival.routeShortName,
      routeColor: arrival.routeColor,
      routeTextColor: arrival.routeTextColor,
      directionId: arrival.directionId,
      headsign: arrival.headsign,
      vehicleId: arrival.vehicleId,
      expectedAt: arrival.expectedAt,
      isRealtime: arrival.isRealtime,
      accessible: arrival.accessible,
      vehicleLocation: arrival.vehicleLocation
        ? { lat: arrival.vehicleLocation.lat, lon: arrival.vehicleLocation.lon }
        : null,
    };
  },
};
