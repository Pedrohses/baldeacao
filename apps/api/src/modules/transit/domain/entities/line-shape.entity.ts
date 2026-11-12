import type { Coordinates } from '../value-objects/coordinates';
import type { DirectionId } from '../value-objects/route-type';

export interface LineShapeProps {
  routeId: string;
  sourceId: string;
  directionId: DirectionId;
  shapeId: string;
  points: Coordinates[];
}

/** Traçado de uma linha num sentido, em ordem de percurso. */
export class LineShape {
  readonly routeId: string;
  readonly sourceId: string;
  readonly directionId: DirectionId;
  readonly shapeId: string;
  readonly points: Coordinates[];

  constructor(props: LineShapeProps) {
    this.routeId = props.routeId;
    this.sourceId = props.sourceId;
    this.directionId = props.directionId;
    this.shapeId = props.shapeId;
    this.points = props.points;
  }
}
