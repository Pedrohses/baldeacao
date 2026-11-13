import type { Route } from '@baldeacao/types';

import { LineBadge } from '@/shared/ui/line-badge';

export interface LineHeaderProps {
  line: Pick<Route, 'shortName' | 'longName' | 'color' | 'textColor'>;
}

/** Código da linha em selo com a cor da linha, seguido do nome. */
export function LineHeader({ line }: LineHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <LineBadge shortName={line.shortName} color={line.color} textColor={line.textColor} />
      <h2 className="screen-title line-clamp-2 min-w-0">{line.longName}</h2>
    </div>
  );
}
