import type { Coordinates } from '../value-objects/coordinates';
import type { DirectionId } from '../value-objects/route-type';

export interface ArrivalProps {
  stopId: string;
  routeId: string;
  routeShortName: string;
  /** Cor da linha (route_color do GTFS, hex sem #); a fonte de tempo real não traz. */
  routeColor?: string | null;
  routeTextColor?: string | null;
  directionId: DirectionId;
  headsign: string | null;
  vehicleId: string | null;
  /** ISO 8601 com o fuso local da fonte, ex.: "2026-11-12T12:36:00-03:00". */
  expectedAt: string;
  isRealtime: boolean;
  accessible: boolean | null;
  vehicleLocation: Coordinates | null;
}

/** Previsão de chegada de um veículo numa parada. */
export class Arrival {
  readonly stopId: string;
  readonly routeId: string;
  readonly routeShortName: string;
  readonly routeColor: string | null;
  readonly routeTextColor: string | null;
  readonly directionId: DirectionId;
  readonly headsign: string | null;
  readonly vehicleId: string | null;
  readonly expectedAt: string;
  readonly isRealtime: boolean;
  readonly accessible: boolean | null;
  readonly vehicleLocation: Coordinates | null;

  constructor(props: ArrivalProps) {
    this.stopId = props.stopId;
    this.routeId = props.routeId;
    this.routeShortName = props.routeShortName;
    this.routeColor = props.routeColor ?? null;
    this.routeTextColor = props.routeTextColor ?? null;
    this.directionId = props.directionId;
    this.headsign = props.headsign;
    this.vehicleId = props.vehicleId;
    this.expectedAt = props.expectedAt;
    this.isRealtime = props.isRealtime;
    this.accessible = props.accessible;
    this.vehicleLocation = props.vehicleLocation;
  }

  /** Cópia com as cores da linha (vindas da rede planejada). */
  withRouteColors(color: string | null, textColor: string | null): Arrival {
    return new Arrival({ ...this, routeColor: color, routeTextColor: textColor });
  }

  get expectedAtMs(): number {
    return Date.parse(this.expectedAt);
  }
}
