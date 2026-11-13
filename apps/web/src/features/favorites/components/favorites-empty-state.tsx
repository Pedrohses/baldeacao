import Link from 'next/link';

import { StarIcon } from '@/shared/ui/icons';

/** Estado vazio da aba Favoritos (só paradas por enquanto). */
export function FavoritesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-2 text-brand">
        <StarIcon className="size-7" />
      </span>
      <h2 className="text-xl font-bold">Nenhum favorito ainda</h2>
      <p className="max-w-72 text-muted">
        Escolha uma parada e toque em &ldquo;Salvar nos favoritos&rdquo;. As paradas salvas aparecem
        aqui, com as próximas chegadas.
      </p>
      <Link
        href="/viagem"
        className="mt-2 inline-flex h-11 items-center rounded-sm bg-brand px-5 font-bold text-brand-fg"
      >
        Planejar uma viagem
      </Link>
    </div>
  );
}
