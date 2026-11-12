export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Tipo do lugar: endereço, ponto de interesse, parada de ônibus (`stop`), estação de metrô ou
 * trem (`station`) ou coordenada solta.
 */
export type PlaceKind = 'address' | 'poi' | 'stop' | 'station' | 'coordinates';

export interface PlaceProps {
  id: string;
  name: string;
  address: string | null;
  kind: PlaceKind;
  location: Coordinates;
}

/** Lugar encontrado na geocodificação. `id` é estável para o mesmo lugar (ex.: "osm:way:123"). */
export class Place {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly kind: PlaceKind;
  readonly location: Coordinates;

  constructor(props: PlaceProps) {
    this.id = props.id;
    this.name = props.name;
    this.address = props.address;
    this.kind = props.kind;
    this.location = { lat: props.location.lat, lon: props.location.lon };
  }
}
