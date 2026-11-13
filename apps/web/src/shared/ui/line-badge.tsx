import type { ReactNode } from 'react';

import { isVeryLight, readableTextColor, toHexColor } from '@/shared/utils/color';

export type LineBadgeSize = 'sm' | 'md';

export interface LineBadgeProps {
  /** Código da linha como aparece no letreiro ("875A-10", "L4"). */
  shortName: string;
  /** route_color do GTFS (com ou sem #); sem cor, o selo fica no neutro `--line-fallback`. */
  color?: string | null;
  /** route_text_color do GTFS; sem ela, preto ou branco pelo maior contraste. */
  textColor?: string | null;
  /** Ícone decorativo à esquerda (ex.: modo de transporte). */
  icon?: ReactNode;
  /** Texto só para leitor de tela antes do código (ex.: "Metrô"). */
  srLabel?: string;
  size?: LineBadgeSize;
  className?: string;
  testId?: string;
}

const SIZE_CLASS: Record<LineBadgeSize, string> = {
  sm: 'h-6 min-w-11 text-sm',
  md: 'h-7 min-w-11 text-[0.9375rem]',
};

/**
 * Selo de linha no padrão de transporte: retângulo de cantos pequenos na cor do GTFS, código em
 * Nunito 800 com números tabulares. Cor de linha é dado; a cor da marca nunca entra aqui.
 */
export function LineBadge({
  shortName,
  color,
  textColor,
  icon,
  srLabel,
  size = 'md',
  className = '',
  testId = 'line-badge',
}: LineBadgeProps) {
  const background = toHexColor(color);
  const foreground = background ? (toHexColor(textColor) ?? readableTextColor(background)) : null;
  const outlined = background !== null && isVeryLight(background);

  return (
    <span
      data-testid={testId}
      className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-badge px-1.5 font-extrabold tracking-[-0.01em] tabular-nums ${SIZE_CLASS[size]} ${
        background ? '' : 'bg-line-fallback text-line-fallback-fg'
      } ${outlined ? 'border border-border-strong' : ''} ${className}`}
      style={
        background ? { backgroundColor: background, color: foreground ?? undefined } : undefined
      }
    >
      {icon}
      {srLabel ? <span className="sr-only">{srLabel} </span> : null}
      {shortName}
    </span>
  );
}
