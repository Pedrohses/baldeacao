import type { Route } from '@baldeacao/types';

import { LineBadge } from './line-badge';

export interface LineHeaderProps {
  line: Pick<Route, 'shortName' | 'longName' | 'color' | 'textColor'>;
}

/** Código da linha em selo com a cor da linha, seguido do nome. */
export function LineHeader({ line }: LineHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <LineBadge line={line} />
      <h2 className="min-w-0 truncate text-xl font-bold">{line.longName}</h2>
    </div>
  );
}
