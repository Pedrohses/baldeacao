'use client';

import type { Stop } from '@baldeacao/types';
import { useState } from 'react';

import {
  FavoriteStopButton,
  FavoriteStopsList,
  FavoritesEmptyState,
  useFavoriteStops,
} from '@/features/favorites';
import { useMapStore } from '@/features/live-map';
import { ArrivalsListView, NearbyStopsList, StopSheet, useStopArrivals } from '@/features/stops';
import { useGeolocation } from '@/shared/hooks/use-geolocation';
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

/** Arredonda para ~100 m: a consulta de paradas não muda a cada arrasto curto. */
function roundCenter(lat: number, lon: number) {
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 };
}

/**
 * Sem favoritos ainda: as paradas perto, para salvar dali mesmo. A parada escolhida abre no
 * próprio painel com o botão de favoritar.
 */
function NearbyToFavorite() {
  const { position } = useGeolocation();
  const viewport = useMapStore((state) => state.viewport);
  const [selected, setSelected] = useState<Stop | null>(null);
  const center = position
    ? roundCenter(position.lat, position.lon)
    : roundCenter(viewport.latitude, viewport.longitude);

  if (selected) {
    return (
      <StopSheet
        stop={selected}
        onClose={() => setSelected(null)}
        actions={<FavoriteStopButton stop={selected} />}
      />
    );
  }
  return (
    <section aria-labelledby="favorites-nearby-title" className="mt-2 border-t border-border pt-4">
      <h2 id="favorites-nearby-title" className="mb-1 text-base font-bold">
        {position ? 'Paradas perto de você' : 'Paradas perto do centro do mapa'}
      </h2>
      <NearbyStopsList center={center} onSelectStop={setSelected} />
    </section>
  );
}

/** Aba Favoritos: paradas salvas com as 2 próximas chegadas, ou o estado vazio. */
export function FavoritesScreen() {
  const { stops } = useFavoriteStops();
  return (
    <main className={SCREEN_CLASS}>
      <AppPanel title="Favoritos" snap="mid">
        {stops.length === 0 ? (
          <>
            <FavoritesEmptyState />
            <NearbyToFavorite />
          </>
        ) : (
          <FavoriteStopsList renderStop={(stop) => <StopNextArrivals stopId={stop.id} />} />
        )}
      </AppPanel>
    </main>
  );
}
