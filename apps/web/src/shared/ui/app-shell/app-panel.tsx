'use client';

import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react';

import { useIsDesktop } from '@/shared/hooks/use-media-query';

import { PANEL_SNAPS, type PanelSnap, nextSnap, snapHeightPx } from './panel-snap';
import { useViewportHeight } from './use-viewport-height';

export interface AppPanelProps {
  /** Título do painel (vira o h1 da tela). */
  title: string;
  /** Esconde o título visualmente (continua para leitor de tela). */
  titleHidden?: boolean;
  /** Altura no celular; sem ela o painel controla a própria altura. */
  snap?: PanelSnap;
  onSnapChange?: (snap: PanelSnap) => void;
  children: ReactNode;
}

const SNAP_LABELS: Record<PanelSnap, string> = { low: 'baixa', mid: 'média', high: 'alta' };
const HANDLE_PX = 44;
// Abaixo disso o gesto na alça é toque (alterna a altura), não arraste.
const DRAG_THRESHOLD_PX = 6;

interface DragState {
  pointerId: number;
  startY: number;
  startHeight: number;
  height: number;
  moved: boolean;
}

function nearestSnap(height: number, viewportHeight: number): PanelSnap {
  let best: PanelSnap = 'low';
  for (const snap of PANEL_SNAPS) {
    const distance = Math.abs(snapHeightPx(snap, viewportHeight) - height);
    if (distance < Math.abs(snapHeightPx(best, viewportHeight) - height)) best = snap;
  }
  return best;
}

/**
 * Painel de conteúdo da tela: bottom sheet arrastável no celular (alturas baixa, média e alta;
 * a alça é um botão que alterna as alturas) e painel lateral fixo de 400 px no desktop. Não é
 * diálogo: o mapa e as abas continuam acessíveis e o foco nunca fica preso nele.
 */
export function AppPanel({
  title,
  titleHidden = false,
  snap: snapProp,
  onSnapChange,
  children,
}: AppPanelProps) {
  const isDesktop = useIsDesktop();
  const viewportHeight = useViewportHeight();
  const titleId = useId();
  const [ownSnap, setOwnSnap] = useState<PanelSnap>('low');
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const snap = snapProp ?? ownSnap;

  function setSnap(next: PanelSnap) {
    setOwnSnap(next);
    onSnapChange?.(next);
  }

  if (isDesktop) {
    return (
      <aside
        aria-labelledby={titleId}
        className="surface-float absolute inset-y-0 left-0 z-30 flex w-[400px] flex-col"
      >
        <h1 id={titleId} className={titleHidden ? 'sr-only' : 'screen-title px-4 pt-4 pb-2'}>
          {title}
        </h1>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6">
          {children}
        </div>
      </aside>
    );
  }

  const maxHeight = snapHeightPx('high', viewportHeight);
  const minHeight = snapHeightPx('low', viewportHeight);
  const height = drag ? drag.height : snapHeightPx(snap, viewportHeight);
  const next = nextSnap(snap);

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
      height,
      moved: false,
    });
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = drag.startY - event.clientY;
    const moved = drag.moved || Math.abs(delta) > DRAG_THRESHOLD_PX;
    const nextHeight = Math.min(maxHeight, Math.max(minHeight, drag.startHeight + delta));
    setDrag({ ...drag, moved, height: moved ? nextHeight : drag.startHeight });
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag.moved) {
      suppressClickRef.current = true;
      setSnap(nearestSnap(drag.height, viewportHeight));
    }
    setDrag(null);
  }

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
  };

  return (
    <section
      aria-labelledby={titleId}
      className="surface-float fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-lg text-text"
      style={{
        height: maxHeight,
        transform: `translateY(${maxHeight - height}px)`,
        transition: drag ? 'none' : 'transform 180ms var(--ease-app)',
      }}
      data-snap={snap}
    >
      <button
        type="button"
        {...handlers}
        onClick={() => {
          // Fim de arraste também gera clique: só o toque (ou Enter/Espaço) alterna a altura.
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setSnap(next);
        }}
        aria-label={`Altura do painel: ${SNAP_LABELS[snap]}. Mudar para ${SNAP_LABELS[next]}.`}
        className="flex w-full shrink-0 touch-none items-center justify-center rounded-t-lg"
        style={{ height: HANDLE_PX }}
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border" />
      </button>
      <h1 id={titleId} className={titleHidden ? 'sr-only' : 'screen-title px-4 pb-2'}>
        {title}
      </h1>
      <div
        className="scrollbar-none min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
        // Ocupa exatamente a parte visível: o fim da lista não some sob a barra e listas
        // suspensas (sugestões de lugar) têm espaço sem serem cortadas pela rolagem.
        style={{ height: `calc(${height}px - var(--nav-h) - ${HANDLE_PX}px)` }}
      >
        {children}
      </div>
    </section>
  );
}
