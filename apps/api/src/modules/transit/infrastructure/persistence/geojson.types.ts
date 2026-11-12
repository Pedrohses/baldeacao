// O TypeORM lê colunas geography como GeoJSON (ST_AsGeoJSON). Só as formas usadas aqui.
export type GeoJsonPosition = [lon: number, lat: number, ...rest: number[]];

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: GeoJsonPosition;
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: GeoJsonPosition[];
}
