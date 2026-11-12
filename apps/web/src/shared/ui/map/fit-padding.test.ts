import { describe, expect, it } from 'vitest';

import { clampPadding, fitPaddingFor, visibleCenterPoint } from './fit-padding';

const DESKTOP = { top: 64, bottom: 64, left: 448, right: 64 };

describe('clampPadding', () => {
  it('mantém a folga quando cabe no canvas', () => {
    expect(clampPadding(DESKTOP, 1200, 800)).toEqual(DESKTOP);
    expect(clampPadding(10, 300, 300)).toEqual({ top: 10, bottom: 10, left: 10, right: 10 });
  });

  it('reduz na proporção quando a folga passaria do canvas', () => {
    const box = clampPadding(DESKTOP, 500, 150);
    expect(box.left + box.right).toBeLessThanOrEqual(500 - 64);
    expect(box.top + box.bottom).toBeLessThanOrEqual(150 - 64);
    expect(box.left).toBeGreaterThan(box.right);
  });

  it('canvas sem tamanho vira folga zero', () => {
    expect(clampPadding(DESKTOP, 0, 0)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
  });
});

describe('visibleCenterPoint', () => {
  it('fica no meio da área que o painel não cobre', () => {
    expect(visibleCenterPoint(DESKTOP, 1200, 800)).toEqual([(448 + 1200 - 64) / 2, 400]);
    expect(visibleCenterPoint({ top: 56, bottom: 424, left: 32, right: 32 }, 400, 800)).toEqual([
      200, 216,
    ]);
  });
});

describe('fitPaddingFor', () => {
  const sized = (clientWidth: number, clientHeight: number) =>
    ({ clientWidth, clientHeight }) as HTMLElement;

  it('usa o menor entre o contêiner e o canvas (canvas ainda no tamanho antigo)', () => {
    const map = { getContainer: () => sized(1208, 800), getCanvas: () => sized(320, 480) };
    const box = fitPaddingFor(map, DESKTOP);
    expect(box.left + box.right).toBeLessThanOrEqual(320 - 64);
  });

  it('sem contêiner devolve a folga pedida', () => {
    expect(fitPaddingFor({}, 8)).toEqual({ top: 8, bottom: 8, left: 8, right: 8 });
  });
});
