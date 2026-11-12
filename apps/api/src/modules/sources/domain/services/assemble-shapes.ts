import type { GtfsShape, GtfsShapePoint } from '../entities/gtfs-feed.entity';

export interface AssembledShapes {
  shapes: GtfsShape[];
  /** shape_id com menos de dois pontos: não formam LineString e ficam de fora. */
  skipped: string[];
}

/**
 * Agrupa os pontos de shapes.txt por shape_id e ordena por shape_pt_sequence.
 * O arquivo não precisa vir ordenado; pontos com sequência repetida ficam com o último lido.
 */
export async function assembleShapes(
  points: AsyncIterable<GtfsShapePoint>,
): Promise<AssembledShapes> {
  const byShape = new Map<string, Map<number, { lat: number; lon: number }>>();
  for await (const point of points) {
    let sequence = byShape.get(point.shapeId);
    if (!sequence) {
      sequence = new Map();
      byShape.set(point.shapeId, sequence);
    }
    sequence.set(point.sequence, { lat: point.lat, lon: point.lon });
  }

  const shapes: GtfsShape[] = [];
  const skipped: string[] = [];
  for (const [shapeId, sequence] of byShape) {
    if (sequence.size < 2) {
      skipped.push(shapeId);
      continue;
    }
    const ordered = [...sequence.entries()].sort(([a], [b]) => a - b).map(([, coords]) => coords);
    shapes.push({ shapeId, points: ordered });
  }
  return { shapes, skipped };
}
