import { arrivalExample } from '@baldeacao/types/examples';
import { describe, expect, it } from 'vitest';

import { nearbyLinesFrom } from './nearby-lines';

const at = (routeId: string, minute: number, directionId: 0 | 1 = 0) => ({
  ...arrivalExample,
  routeId,
  routeShortName: routeId,
  directionId,
  expectedAt: `2026-11-12T12:${String(minute).padStart(2, '0')}:00-03:00`,
});

describe('nearbyLinesFrom', () => {
  it('uma entrada por linha e sentido, com a chegada mais próxima, em ordem', () => {
    const lines = nearbyLinesFrom(
      [at('875A-10', 40), at('8000-10', 35), at('875A-10', 36), at('875A-10', 50, 1)],
      10,
    );
    expect(lines.map((l) => [l.routeId, l.next.expectedAt.slice(11, 16)])).toEqual([
      ['8000-10', '12:35'],
      ['875A-10', '12:36'],
      ['875A-10', '12:50'],
    ]);
  });

  it('respeita o limite', () => {
    expect(nearbyLinesFrom([at('a', 1), at('b', 2), at('c', 3)], 2)).toHaveLength(2);
  });
});
