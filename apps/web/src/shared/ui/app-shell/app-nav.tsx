'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';

import { BusIcon, type IconProps, MapIcon, RouteIcon, StarIcon } from '../icons';
import { ThemeToggle } from '../theme-toggle';

interface NavItem {
  href: '/' | '/viagem' | '/linhas' | '/favoritos';
  label: string;
  Icon: ComponentType<IconProps>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Mapa', Icon: MapIcon },
  { href: '/viagem', label: 'Viagem', Icon: RouteIcon },
  { href: '/linhas', label: 'Linhas', Icon: BusIcon },
  { href: '/favoritos', label: 'Favoritos', Icon: StarIcon },
];

export function isActivePath(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Abas do app: barra inferior no celular, trilho vertical de 72 px no desktop. */
export function AppNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 h-[var(--nav-h)] border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:top-0 md:left-0 md:h-full md:w-[72px] md:border-t-0 md:border-r md:pt-3 md:pb-0"
    >
      <ul className="flex h-full items-stretch justify-around md:h-auto md:flex-col md:justify-start md:gap-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={href} className="flex flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-1 font-display text-xs font-semibold tracking-[0.06em] uppercase transition-colors md:mx-0 md:py-3 ${
                  active ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
                }`}
              >
                {/* Aba ativa: filete âmbar no topo (celular) ou à esquerda (desktop), sem pílula. */}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-[28%] top-0 h-[3px] bg-brand md:inset-x-auto md:inset-y-[20%] md:left-0 md:h-auto md:w-[3px]"
                  />
                ) : null}
                <Icon className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <ThemeToggle showLabel className="absolute inset-x-0 bottom-4 hidden min-h-12 md:flex" />
    </nav>
  );
}
