'use client';

import { LineSearch } from '@/features/lines';
import { AppPanel, SCREEN_CLASS } from '@/shared/ui/app-shell';

function lineHref(routeId: string): string {
  return `/linhas/${encodeURIComponent(routeId)}`;
}

/** Aba Linhas: busca por código ou nome sobre o mapa. */
export function LinesScreen() {
  return (
    <main className={SCREEN_CLASS}>
      <AppPanel title="Linhas" snap="high">
        <LineSearch hrefFor={(line) => lineHref(line.id)} />
      </AppPanel>
    </main>
  );
}
