export interface PaddingBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Menor área livre (px) que o enquadramento deixa para o conteúdo em cada eixo. */
export const MIN_FIT_AREA_PX = 64;

function toBox(padding: number | PaddingBox): PaddingBox {
  return typeof padding === 'number'
    ? { top: padding, bottom: padding, left: padding, right: padding }
    : padding;
}

function shrink(a: number, b: number, size: number): [number, number] {
  const room = Math.max(0, size - MIN_FIT_AREA_PX);
  if (a + b <= room) return [a, b];
  const scale = room / (a + b);
  return [Math.floor(a * scale), Math.floor(b * scale)];
}

/**
 * Limita a folga ao tamanho do canvas: em tela pequena a folga do painel passaria do canvas e o
 * MapLibre avisaria "Map cannot fit within canvas" sem enquadrar. Reduz cada eixo na proporção.
 */
export function clampPadding(
  padding: number | PaddingBox,
  width: number,
  height: number,
): PaddingBox {
  const box = toBox(padding);
  const [left, right] = shrink(box.left, box.right, width);
  const [top, bottom] = shrink(box.top, box.bottom, height);
  return { top, bottom, left, right };
}

/** Ponto (px do canvas) no meio da área que o painel não cobre. */
export function visibleCenterPoint(
  padding: number | PaddingBox,
  width: number,
  height: number,
): [number, number] {
  const box = clampPadding(padding, width, height);
  return [(box.left + width - box.right) / 2, (box.top + height - box.bottom) / 2];
}

interface SizedMap {
  getContainer?: () => HTMLElement;
  getCanvas?: () => HTMLElement;
}

/**
 * Folga limitada ao canvas deste mapa (sem canvas conhecido, a folga pedida). Logo depois de
 * redimensionar a janela o canvas ainda tem o tamanho antigo até o MapLibre chamar resize(): vale
 * o menor dos dois.
 */
export function fitPaddingFor(map: SizedMap, padding: number | PaddingBox): PaddingBox {
  const container = map.getContainer?.();
  if (!container) return toBox(padding);
  const canvas = map.getCanvas?.();
  const width = Math.min(container.clientWidth, canvas?.clientWidth ?? Infinity);
  const height = Math.min(container.clientHeight, canvas?.clientHeight ?? Infinity);
  return clampPadding(padding, width, height);
}
