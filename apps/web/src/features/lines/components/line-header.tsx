import type { Route } from '@baldeacao/types';

export interface LineHeaderProps {
  line: Pick<Route, 'shortName' | 'longName' | 'color' | 'textColor'>;
}

const FALLBACK_COLOR = '0B4F5C';
const FALLBACK_TEXT_COLOR = 'FFFFFF';

/** Código da linha em selo com a cor da linha, seguido do nome. */
export function LineHeader({ line }: LineHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        data-testid="line-badge"
        className="inline-flex min-w-12 items-center justify-center rounded-md px-2 py-1 text-base font-bold"
        style={{
          backgroundColor: `#${line.color ?? FALLBACK_COLOR}`,
          color: `#${line.textColor ?? FALLBACK_TEXT_COLOR}`,
        }}
      >
        {line.shortName}
      </span>
      <h2 className="min-w-0 truncate text-xl font-bold">{line.longName}</h2>
    </div>
  );
}
