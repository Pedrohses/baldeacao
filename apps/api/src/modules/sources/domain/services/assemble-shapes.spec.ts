import type { GtfsShapePoint } from '../entities/gtfs-feed.entity';
import { assembleShapes } from './assemble-shapes';

async function* points(items: GtfsShapePoint[]): AsyncIterable<GtfsShapePoint> {
  for (const item of items) yield await Promise.resolve(item);
}

describe('assembleShapes', () => {
  it('agrupa por shape_id e ordena por sequência, mesmo fora de ordem no arquivo', async () => {
    const result = await assembleShapes(
      points([
        { shapeId: 'a', lat: -23.3, lon: -46.3, sequence: 3 },
        { shapeId: 'b', lat: -23.9, lon: -46.9, sequence: 1 },
        { shapeId: 'a', lat: -23.1, lon: -46.1, sequence: 1 },
        { shapeId: 'b', lat: -23.8, lon: -46.8, sequence: 2 },
        { shapeId: 'a', lat: -23.2, lon: -46.2, sequence: 2 },
      ]),
    );

    expect(result.skipped).toEqual([]);
    expect(result.shapes).toEqual([
      {
        shapeId: 'a',
        points: [
          { lat: -23.1, lon: -46.1 },
          { lat: -23.2, lon: -46.2 },
          { lat: -23.3, lon: -46.3 },
        ],
      },
      {
        shapeId: 'b',
        points: [
          { lat: -23.9, lon: -46.9 },
          { lat: -23.8, lon: -46.8 },
        ],
      },
    ]);
  });

  it('deixa de fora shapes com menos de dois pontos', async () => {
    const result = await assembleShapes(
      points([
        { shapeId: 'solo', lat: -23.1, lon: -46.1, sequence: 1 },
        { shapeId: 'dup', lat: -23.1, lon: -46.1, sequence: 1 },
        { shapeId: 'dup', lat: -23.2, lon: -46.2, sequence: 1 },
      ]),
    );

    expect(result.shapes).toEqual([]);
    expect(result.skipped).toEqual(['solo', 'dup']);
  });
});
