import type { ReactNode } from 'react';

import { AppShell } from '@/shared/ui/app-shell';

import { PersistentMap } from './persistent-map';

/**
 * Casca das telas do mapa: abas (Mapa, Viagem, Linhas, Favoritos), o mapa persistente (não é
 * recriado ao trocar de aba) e, por cima dele, o painel de cada tela.
 */
export default function MapLayout({ children }: { children: ReactNode }) {
  return <AppShell map={<PersistentMap />}>{children}</AppShell>;
}
