import type { RouteType } from '../value-objects/route-type';

export interface RouteProps {
  id: string;
  sourceId: string;
  shortName: string;
  longName: string;
  type: RouteType;
  color: string | null;
  textColor: string | null;
}

/** Linha da rede planejada (routes.txt). */
export class Route {
  readonly id: string;
  readonly sourceId: string;
  readonly shortName: string;
  readonly longName: string;
  readonly type: RouteType;
  readonly color: string | null;
  readonly textColor: string | null;

  constructor(props: RouteProps) {
    this.id = props.id;
    this.sourceId = props.sourceId;
    this.shortName = props.shortName;
    this.longName = props.longName;
    this.type = props.type;
    this.color = props.color;
    this.textColor = props.textColor;
  }
}
