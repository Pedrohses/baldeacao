'use client';

import { FavoriteStopsList, FavoritesEmptyState, useFavoriteStops } from '@/features/favorites';
import { ArrivalsListView, useStopArrivals } from '@/features/stops';
import { useNow } from '@/shared/hooks/use-now';
import { AppPanel, SCREEN_CLASS } from '@/shared/ui/app-shell';

const NEXT_ARRIVALS = 2;

function StopNextArrivals({ stopId }: { stopId: string }) {
  const { data, isPending, isError } = useStopArrivals(stopId);
  const now = useNow();
  if (isPending) return <p className="mt-1 text-sm text-muted">Carregando previsões...</p>;
  if (isError) return <p className="mt-1 text-sm text-danger">Previsões indisponíveis agora.</p>;
  return <ArrivalsListView arrivals={data.slice(0, NEXT_ARRIVALS)} now={now} />;
}

/** Aba Favoritos: paradas salvas com as 2 próximas chegadas, ou o estado vazio. */
export function FavoritesScreen() {
  const { stops } = useFavoriteStops();
  return (
    <main className={SCREEN_CLASS}>
      <AppPanel title="Favoritos" snap="mid">
        {stops.length === 0 ? (
          <FavoritesEmptyState />
        ) : (
          <FavoriteStopsList renderStop={(stop) => <StopNextArrivals stopId={stop.id} />} />
        )}
      </AppPanel>
    </main>
  );
}
