'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';

import { type IconProps, MapIcon, RouteIcon, StarIcon } from '../icons';

interface NavItem {
  href: '/' | '/viagem' | '/favoritos';
  label: string;
  Icon: ComponentType<IconProps>;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Mapa', Icon: MapIcon },
  { href: '/viagem', label: 'Viagem', Icon: RouteIcon },
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
                className={`group flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-sm text-xs font-bold md:mx-2 md:py-2 ${
                  active ? 'text-brand' : 'text-muted hover:text-text'
                }`}
              >
                <span
                  className={`inline-flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-brand/15' : 'group-hover:bg-surface-2'
                  }`}
                >
                  <Icon className="size-6" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
