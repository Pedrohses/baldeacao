'use client';

import { FavoritesEmptyState } from '@/features/favorites';
import { useMapStore } from '@/features/live-map';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { AppPanel } from '@/shared/ui/app-shell';
import { BaseMap } from '@/shared/ui/map';

/** Aba Favoritos: por enquanto só o estado vazio sobre o mapa. */
export function FavoritesScreen() {
  const viewport = useMapStore((state) => state.viewport);
  const isDesktop = useIsDesktop();

  return (
    <main className="relative h-full w-full">
      <BaseMap initialViewState={viewport} showNavigation={isDesktop} />
      <AppPanel title="Favoritos" snap="mid">
        <FavoritesEmptyState />
      </AppPanel>
    </main>
  );
}
