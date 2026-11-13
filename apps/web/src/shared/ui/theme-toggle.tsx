'use client';

import type { ComponentType } from 'react';

import { useThemePreference } from '@/shared/hooks/use-theme';
import type { ThemePreference } from '@/shared/lib/theme';

import { type IconProps, MonitorIcon, MoonIcon, SunIcon } from './icons';

const NEXT: Record<ThemePreference, ThemePreference> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
};

const LABEL: Record<ThemePreference, string> = {
  dark: 'escuro',
  light: 'claro',
  system: 'do sistema',
};

const ICON: Record<ThemePreference, ComponentType<IconProps>> = {
  dark: MoonIcon,
  light: SunIcon,
  system: MonitorIcon,
};

export interface ThemeToggleProps {
  className?: string;
  /** Mostra o nome do tema embaixo do ícone (trilho do desktop). */
  showLabel?: boolean;
}

/** Alterna o tema: escuro (padrão), claro e do sistema, nessa ordem. */
export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [preference, setPreference] = useThemePreference();
  const Icon = ICON[preference];
  const next = NEXT[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={`Tema ${LABEL[preference]}. Trocar para ${LABEL[next]}`}
      title={`Tema ${LABEL[preference]}`}
      className={`flex-col items-center justify-center gap-1 text-muted transition-colors hover:text-text ${className}`}
    >
      <Icon className="size-5" />
      {showLabel ? (
        <span className="font-display text-xs font-semibold tracking-[0.06em] uppercase">
          {preference === 'system' ? 'Sistema' : preference === 'dark' ? 'Escuro' : 'Claro'}
        </span>
      ) : null}
    </button>
  );
}
