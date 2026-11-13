import { routeExample } from '@baldeacao/types/examples';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { RECENT_LINES_MAX, resetRecentLinesCache, useRecentLines } from './use-recent-lines';

beforeEach(() => {
  localStorage.clear();
  resetRecentLinesCache();
});

describe('useRecentLines', () => {
  it('guarda a linha no topo, sem repetir, até o limite', () => {
    const { result } = renderHook(() => useRecentLines());
    expect(result.current.recents).toEqual([]);

    act(() => result.current.addRecent(routeExample));
    act(() => result.current.addRecent({ ...routeExample, id: 'B', shortName: 'B' }));
    act(() => result.current.addRecent(routeExample));

    expect(result.current.recents.map((l) => l.id)).toEqual([routeExample.id, 'B']);

    for (let i = 0; i < RECENT_LINES_MAX + 2; i += 1) {
      act(() => result.current.addRecent({ ...routeExample, id: `X${i}`, shortName: `X${i}` }));
    }
    expect(result.current.recents).toHaveLength(RECENT_LINES_MAX);
  });

  it('ignora dado corrompido', () => {
    localStorage.setItem('baldeacao:recent-lines', '[{"id":1}]');
    const { result } = renderHook(() => useRecentLines());
    expect(result.current.recents).toEqual([]);
  });
});
