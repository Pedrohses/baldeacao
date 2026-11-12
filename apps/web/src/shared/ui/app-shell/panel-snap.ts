// Alturas do painel no celular, medidas a partir do pé da janela. A barra de abas (64 px) fica
// por cima do painel: a altura baixa soma a barra para sobrar 152 px visíveis (alça de 44 px,
// "Para onde?" de 56 px e uma fileira de recentes).
export type PanelSnap = 'low' | 'mid' | 'high';

export const PANEL_SNAPS: readonly PanelSnap[] = ['low', 'mid', 'high'];

export const NAV_HEIGHT_PX = 64;
export const LOW_SNAP_PX = 216;
export const DESKTOP_PANEL_WIDTH_PX = 400;

/** A alça alterna baixa, média e alta, e da alta volta para a baixa. */
export function nextSnap(snap: PanelSnap): PanelSnap {
  return PANEL_SNAPS[(PANEL_SNAPS.indexOf(snap) + 1) % PANEL_SNAPS.length] ?? 'low';
}

/** Altura visível do painel (contando a parte sob a barra de abas), em px. */
export function snapHeightPx(snap: PanelSnap, viewportHeight: number): number {
  if (snap === 'low') return LOW_SNAP_PX;
  return Math.round((snap === 'mid' ? 0.5 : 0.92) * viewportHeight);
}

export interface MapPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Folga para fitBounds: o que o painel cobre não conta como área útil do mapa. No desktop o canvas
 * já começa depois do trilho (72 px), então a folga esquerda é o painel (400 px) mais a margem.
 * Quem enquadra limita a folga ao canvas (shared/ui/map/fit-padding).
 */
export function mapPaddingFor(
  isDesktop: boolean,
  snap: PanelSnap,
  viewportHeight: number,
): MapPadding {
  if (isDesktop) return { top: 64, bottom: 64, right: 64, left: DESKTOP_PANEL_WIDTH_PX + 48 };
  // Com o painel alto, enquadra na metade de cima mesmo assim.
  const covered = snapHeightPx(snap === 'high' ? 'mid' : snap, viewportHeight);
  return { top: 56, bottom: covered + 24, left: 32, right: 32 };
}
