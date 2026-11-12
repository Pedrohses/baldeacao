import type { ReactNode } from 'react';

import { AppNav } from './app-nav';

/**
 * Casca do app: abas fixas e a área da tela (mapa + painel) ao lado. No celular a área ocupa a
 * tela toda, atrás da barra; no desktop começa depois do trilho.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <AppNav />
      <div className="absolute inset-0 md:left-[72px]">{children}</div>
    </div>
  );
}
