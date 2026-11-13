import type { ReactNode } from 'react';

import { ThemeToggle } from '../theme-toggle';
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
        {/* Celular: o trilho não existe, então a troca de tema flutua no canto do mapa. */}
        <ThemeToggle className="surface-float absolute top-[calc(env(safe-area-inset-top)+12px)] left-3 z-30 flex size-11 rounded-sm md:hidden" />
      </div>
    </div>
  );
}

/**
 * Classe do <main> de cada tela sobre o mapa persistente: a área vazia deixa o toque passar
 * para o mapa; painel e avisos (filhos diretos) continuam clicáveis.
 */
export const SCREEN_CLASS = 'pointer-events-none absolute inset-0 *:pointer-events-auto';
