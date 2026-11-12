import type { Route } from '@baldeacao/types';

export const LINE_FALLBACK_COLOR = 'C7361F';
export const LINE_FALLBACK_TEXT_COLOR = 'FFFFFF';

export interface LineBadgeProps {
  line: Pick<Route, 'shortName' | 'color' | 'textColor'>;
  className?: string;
}

/** Selo com o código da linha na cor do GTFS. */
export function LineBadge({ line, className = '' }: LineBadgeProps) {
  return (
    <span
      data-testid="line-badge"
      className={`inline-flex min-w-12 shrink-0 items-center justify-center rounded-md px-2 py-1 font-mono text-base font-bold ${className}`}
      style={{
        backgroundColor: `#${line.color ?? LINE_FALLBACK_COLOR}`,
        color: `#${line.textColor ?? LINE_FALLBACK_TEXT_COLOR}`,
      }}
    >
      {line.shortName}
    </span>
  );
}
