import { toLonLat, type LineShape } from '@baldeacao/types';

export interface ShapeFeatureProperties {
  shapeId: string;
  directionId: 0 | 1;
}

export interface ShapesFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: ShapeFeatureProperties;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
  }[];
}

/** Uma feature LineString por sentido, com coordenadas [lon, lat]. */
export function shapesToGeoJson(shapes: readonly LineShape[]): ShapesFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: shapes.map((shape) => ({
      type: 'Feature',
      properties: { shapeId: shape.shapeId, directionId: shape.directionId },
      geometry: { type: 'LineString', coordinates: shape.points.map(toLonLat) },
    })),
  };
}
