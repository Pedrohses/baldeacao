import type { ReactNode } from 'react';

import { AppShell } from '@/shared/ui/app-shell';

/** Casca das telas do mapa: abas (Mapa, Viagem, Favoritos) e a área de mapa com painel. */
export default function MapLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
