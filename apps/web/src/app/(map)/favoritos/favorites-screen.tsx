'use client';

import { FavoritesEmptyState } from '@/features/favorites';
import { AppPanel, SCREEN_CLASS } from '@/shared/ui/app-shell';

/** Aba Favoritos: por enquanto só o estado vazio sobre o mapa (sem camadas próprias). */
export function FavoritesScreen() {
  return (
    <main className={SCREEN_CLASS}>
      <AppPanel title="Favoritos" snap="mid">
        <FavoritesEmptyState />
      </AppPanel>
    </main>
  );
}
