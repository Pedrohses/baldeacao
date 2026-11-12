import type { ReactNode } from 'react';

import { AppNav } from './app-nav';

/**
 * Casca do app: abas fixas e a área da tela (mapa persistente + painel da tela) ao lado. No celular a área ocupa a
 * tela toda, atrás da barra; no desktop começa depois do trilho.
 */
export function AppShell({ map, children }: { map?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <AppNav />
      <div className="absolute inset-0 md:left-[72px]">
        {map ? <div className="absolute inset-0">{map}</div> : null}
        {children}
      </div>
    </div>
  );
}

/**
 * Classe do <main> de cada tela sobre o mapa persistente: a área vazia deixa o toque passar
 * para o mapa; painel e avisos (filhos diretos) continuam clicáveis.
 */
export const SCREEN_CLASS = 'pointer-events-none absolute inset-0 *:pointer-events-auto';
