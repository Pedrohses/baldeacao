'use client';

import type { Stop } from '@baldeacao/types';

import { StarIcon } from '@/shared/ui/icons';

import { useFavoriteStops } from '../hooks';

/** Estrela para salvar ou remover a parada dos favoritos. */
export function FavoriteStopButton({ stop }: { stop: Stop }) {
  const { isFavorite, toggle } = useFavoriteStops();
  const saved = isFavorite(stop.id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggle(stop)}
      className="inline-flex h-11 items-center gap-2 rounded-sm bg-surface-2 px-4 font-bold"
    >
      <StarIcon className={`size-5 ${saved ? 'fill-current text-brand-ink' : ''}`} />
      {saved ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
    </button>
  );
}
