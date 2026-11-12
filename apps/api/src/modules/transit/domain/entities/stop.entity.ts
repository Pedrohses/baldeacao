import type { Coordinates } from '../value-objects/coordinates';

export interface StopProps {
  id: string;
  sourceId: string;
  code: string | null;
  name: string;
  description: string | null;
  location: Coordinates;
}

/** Parada da rede planejada (stops.txt). */
export class Stop {
  readonly id: string;
  readonly sourceId: string;
  readonly code: string | null;
  readonly name: string;
  readonly description: string | null;
  readonly location: Coordinates;

  constructor(props: StopProps) {
    this.id = props.id;
    this.sourceId = props.sourceId;
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.location = props.location;
  }
}

/** Parada encontrada numa busca por raio, com a distância ao centro em metros. */
export interface NearbyStop {
  stop: Stop;
  distanceM: number;
}

/** Parada achada pelo nome; `isStation` quando é estação de metrô ou trem. */
export interface StopNameMatch {
  stop: Stop;
  isStation: boolean;
}
