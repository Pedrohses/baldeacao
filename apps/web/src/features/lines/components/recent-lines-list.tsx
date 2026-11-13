'use client';

import type { Route } from '@baldeacao/types';
import Link from 'next/link';

import { LineBadge } from '@/shared/ui/line-badge';

import { useRecentLines } from '../hooks';

export interface RecentLinesListProps {
  hrefFor: (line: Route) => string;
}

/** Linhas abertas recentemente neste aparelho; sem nenhuma, não ocupa espaço. */
export function RecentLinesList({ hrefFor }: RecentLinesListProps) {
  const { recents } = useRecentLines();
  if (recents.length === 0) return null;
  return (
    <section aria-labelledby="recent-lines-title" className="mt-6">
      <h2 id="recent-lines-title" className="section-label mb-2">
        Vistas recentemente
      </h2>
      <ul className="-mx-1 divide-y divide-border">
        {recents.map((line) => (
          <li key={line.id}>
            <Link
              href={hrefFor(line)}
              className="flex min-h-14 items-center gap-3 rounded-sm px-1 py-2 transition-colors hover:bg-surface-2"
            >
              <LineBadge shortName={line.shortName} color={line.color} textColor={line.textColor} />
              <span className="min-w-0 flex-1 truncate font-semibold">{line.longName}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
