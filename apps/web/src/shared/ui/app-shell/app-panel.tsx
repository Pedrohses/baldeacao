'use client';

import { useId, useState, type ReactNode } from 'react';
import { Drawer } from 'vaul';

import { useIsDesktop } from '@/shared/hooks/use-media-query';

import {
  LOW_SNAP_PX,
  type PanelSnap,
  SNAP_POINTS,
  nextSnap,
  pointToSnap,
  snapToPoint,
} from './panel-snap';

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

// Parte rolável do painel no celular: altura visível menos a barra de abas e a alça (44 px).
// Sem esse limite o fim da lista ficaria fora da tela nas alturas baixa e média.
const BODY_MAX_HEIGHT: Record<PanelSnap, string> = {
  low: `calc(${LOW_SNAP_PX}px - var(--nav-h) - 44px)`,
  mid: 'calc(50dvh - var(--nav-h) - 44px)',
  high: 'calc(92dvh - var(--nav-h) - 44px)',
};

/**
 * Painel de conteúdo da tela: bottom sheet arrastável (vaul) no celular e painel lateral fixo de
 * 400 px no desktop. O mapa continua utilizável atrás dele.
 */
export function AppPanel({
  title,
  titleHidden = false,
  snap: snapProp,
  onSnapChange,
  children,
}: AppPanelProps) {
  const isDesktop = useIsDesktop();
  const titleId = useId();
  const [ownSnap, setOwnSnap] = useState<PanelSnap>('low');
  const snap = snapProp ?? ownSnap;

  function setSnap(next: PanelSnap) {
    setOwnSnap(next);
    onSnapChange?.(next);
  }

  const titleClass = titleHidden ? 'sr-only' : 'px-4 pb-2 text-xl font-bold';

  if (isDesktop) {
    return (
      <aside
        aria-labelledby={titleId}
        className="surface-float absolute inset-y-0 left-0 z-30 flex w-[400px] flex-col"
      >
        <h1 id={titleId} className={titleHidden ? 'sr-only' : 'px-4 pt-4 pb-2 text-xl font-bold'}>
          {title}
        </h1>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6">
          {children}
        </div>
      </aside>
    );
  }

  const next = nextSnap(snap);

  return (
    <Drawer.Root
      open
      modal={false}
      dismissible={false}
      noBodyStyles
      repositionInputs={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snapToPoint(snap)}
      setActiveSnapPoint={(point) => setSnap(pointToSnap(point))}
    >
      <Drawer.Portal>
        <Drawer.Content
          aria-labelledby={titleId}
          aria-describedby={undefined}
          // O painel é parte da tela, não um diálogo: não rouba o foco ao abrir.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="surface-float fixed inset-x-0 bottom-0 z-30 flex h-dvh flex-col rounded-t-lg text-text outline-none"
        >
          <button
            type="button"
            onClick={() => setSnap(next)}
            aria-label={`Altura do painel: ${SNAP_LABELS[snap]}. Mudar para ${SNAP_LABELS[next]}.`}
            className="flex h-11 w-full shrink-0 items-center justify-center rounded-t-lg"
          >
            <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-border" />
          </button>
          <Drawer.Title asChild>
            <h1 id={titleId} className={titleClass}>
              {title}
            </h1>
          </Drawer.Title>
          <div
            // Dentro do conteúdo o gesto é de rolagem; o arraste fica na alça.
            data-vaul-no-drag=""
            className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-4"
            style={{ maxHeight: BODY_MAX_HEIGHT[snap] }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
