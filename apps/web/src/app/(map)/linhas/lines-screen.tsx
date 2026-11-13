'use client';

import { LineSearch, RecentLinesList } from '@/features/lines';
import { useMapStore } from '@/features/live-map';
import { NearbyLinesList } from '@/features/stops';
import { useGeolocation } from '@/shared/hooks/use-geolocation';
import { AppPanel, SCREEN_CLASS } from '@/shared/ui/app-shell';

function lineHref(routeId: string): string {
  return `/linhas/${encodeURIComponent(routeId)}`;
}

/** Arredonda para ~100 m: a consulta de paradas não muda a cada arrasto curto. */
function roundCenter(lat: number, lon: number) {
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 };
}

/**
 * Aba Linhas: busca por código ou nome. Antes de digitar, mostra as linhas que passam perto
 * (do usuário ou do centro do mapa) e as abertas recentemente.
 */
export function LinesScreen() {
  const { position } = useGeolocation();
  const viewport = useMapStore((state) => state.viewport);
  const center = position
    ? roundCenter(position.lat, position.lon)
    : roundCenter(viewport.latitude, viewport.longitude);

  return (
    <main className={SCREEN_CLASS}>
      <AppPanel title="Linhas" snap="high">
        <LineSearch
          hrefFor={(line) => lineHref(line.id)}
          idleContent={
            <>
              <section aria-labelledby="nearby-lines-title" className="mt-5">
                <h2 id="nearby-lines-title" className="section-label mb-2">
                  {position ? 'Linhas perto de você' : 'Linhas perto do centro do mapa'}
                </h2>
                <NearbyLinesList center={center} hrefFor={lineHref} />
              </section>
              <RecentLinesList hrefFor={(line) => lineHref(line.id)} />
            </>
          }
        />
      </AppPanel>
    </main>
  );
}
