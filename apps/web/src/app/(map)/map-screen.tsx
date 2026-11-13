'use client';

import type { Coordinates, Place, Stop } from '@baldeacao/types';
import Link from 'next/link';
import { useState } from 'react';

import { FavoriteStopButton } from '@/features/favorites';
import { LineHeader, RouteShapeLayer, useLineDetails } from '@/features/lines';
import { StaleDataNotice, VehiclesLayer, useMapStore } from '@/features/live-map';
import { PlaceKindIcon, useMapPointPlace, useRecentPlaces } from '@/features/place-search';
import {
  NEARBY_LIST_LIMIT,
  NEARBY_LINES_PER_STOP,
  NearbyStopsList,
  STOPS_MIN_ZOOM,
  StopSheet,
  StopsLayer,
} from '@/features/stops';
import { buildTripHref } from '@/features/trip-planner';
import { useGeolocation } from '@/shared/hooks/use-geolocation';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { useOneTimeHint } from '@/shared/hooks/use-one-time-hint';
import {
  AppPanel,
  LOW_SNAP_PX,
  type PanelSnap,
  SCREEN_CLASS,
  useMapPadding,
} from '@/shared/ui/app-shell';
import { CloseIcon, SearchIcon } from '@/shared/ui/icons';
import {
  DroppedPin,
  LocateButton,
  MapFlyTo,
  MapLayers,
  MapLongPress,
  UserLocationLayer,
  VisibleCenterSync,
  useMapColors,
} from '@/shared/ui/map';

const RECENT_CHIPS = 3;
// No desktop o painel tem altura para mais paradas e mais chegadas por parada.
const DESKTOP_NEARBY_LIMIT = 8;
const DESKTOP_LINES_PER_STOP = 3;
const MAP_POINT_HINT = 'ponto-no-mapa';
const PRIMARY_ACTION =
  'inline-flex h-11 items-center justify-center rounded-sm bg-brand px-4 font-bold text-brand-fg';
const SECONDARY_ACTION =
  'inline-flex h-11 items-center justify-center rounded-sm border border-border bg-surface px-4 font-bold';

/** Arredonda para ~100 m: a lista de paradas não refaz a consulta a cada arrasto curto. */
function roundCenter(lat: number, lon: number) {
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 };
}

function stopPlace(stop: Stop): Place {
  return {
    id: `stop:${stop.id}`,
    name: stop.name,
    address: stop.description,
    kind: 'stop',
    location: stop.location,
  };
}

/** "Ir para cá" (principal) e "Sair daqui": abrem o planejador com o ponto já preenchido. */
function PlaceActions({ place }: { place: Place }) {
  return (
    <>
      <Link
        href={buildTripHref({ from: 'current-location', to: place })}
        className={PRIMARY_ACTION}
      >
        Ir para cá
      </Link>
      <Link
        href={buildTripHref({ from: place, focus: 'destination' })}
        className={SECONDARY_ACTION}
      >
        Sair daqui
      </Link>
    </>
  );
}

/** Tela inicial: mapa ao vivo, "Para onde?", paradas perto e ações sobre pontos do mapa. */
export function MapScreen() {
  const isDesktop = useIsDesktop();
  const viewport = useMapStore((state) => state.viewport);
  const selection = useMapStore((state) => state.selection);
  const selectStop = useMapStore((state) => state.selectStop);
  const clearSelection = useMapStore((state) => state.clearSelection);
  const { position } = useGeolocation();
  const { recents } = useRecentPlaces();
  const colors = useMapColors();
  const pointHint = useOneTimeHint(MAP_POINT_HINT);

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [flyTarget, setFlyTarget] = useState<Coordinates | null>(null);
  const [snap, setSnap] = useState<PanelSnap>('low');
  const padding = useMapPadding(snap);
  // Centro da parte do mapa que o painel não cobre (o centro do canvas fica sob o painel).
  const [visibleCenter, setVisibleCenter] = useState<Coordinates | null>(null);
  const pinPlace = useMapPointPlace(pin).place;

  const activeStop =
    selection?.kind === 'stop' && selectedStop?.id === selection.stopId ? selectedStop : null;
  const routeId =
    selection?.kind === 'vehicle' || selection?.kind === 'line' ? selection.routeId : null;
  const line = useLineDetails(routeId);
  // Sem cor no GTFS, o neutro de linha (a cor da marca é só para ação e seleção).
  const lineColor = line.data?.line.color ? `#${line.data.line.color}` : colors.lineFallback;

  const stopsCenter =
    viewport.zoom >= STOPS_MIN_ZOOM ? { lat: viewport.latitude, lon: viewport.longitude } : null;
  const nearbyCenter = position
    ? roundCenter(position.lat, position.lon)
    : visibleCenter
      ? roundCenter(visibleCenter.lat, visibleCenter.lon)
      : roundCenter(viewport.latitude, viewport.longitude);

  function handleSelectStop(stop: Stop, fly: boolean) {
    setSelectedStop(stop);
    selectStop(stop.id);
    setPin(null);
    if (fly) setFlyTarget(stop.location);
    setSnap('mid');
  }

  function handleClose() {
    setSelectedStop(null);
    clearSelection();
    setSnap('low');
  }

  let content;
  if (activeStop) {
    content = (
      <StopSheet
        stop={activeStop}
        onClose={handleClose}
        actions={
          <>
            <FavoriteStopButton stop={activeStop} />
            <PlaceActions place={stopPlace(activeStop)} />
          </>
        }
      />
    );
  } else if (routeId) {
    content = (
      <section aria-label="Linha selecionada">
        <div className="flex items-start justify-between gap-2 pt-2">
          {line.data ? (
            <LineHeader line={line.data.line} />
          ) : (
            <p className="text-muted">Carregando a linha {routeId}...</p>
          )}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar linha"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-surface-2"
          >
            <CloseIcon />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">Os ônibus desta linha estão em destaque no mapa.</p>
      </section>
    );
  } else {
    content = (
      <>
        <Link
          href={buildTripHref({ from: 'current-location', focus: 'destination' })}
          className="search-field flex h-14 items-center gap-3 rounded-sm px-4 text-xl font-semibold"
        >
          <SearchIcon className="size-6 text-text" />
          Para onde?
        </Link>
        {recents.length > 0 ? (
          <ul aria-label="Destinos recentes" className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {recents.slice(0, RECENT_CHIPS).map((place) => (
              <li key={place.id} className="shrink-0">
                <Link
                  href={buildTripHref({ from: 'current-location', to: place })}
                  className="inline-flex h-11 max-w-56 items-center gap-1.5 rounded-sm border border-border-strong px-3 text-sm font-semibold transition-colors hover:bg-surface-2"
                >
                  <PlaceKindIcon kind={place.kind} className="size-4 shrink-0 text-muted" />
                  <span className="truncate">{place.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <h2 className="section-label mt-4 mb-2">
          {position ? 'Paradas perto de você' : 'Paradas perto do centro do mapa'}
        </h2>
        <NearbyStopsList
          center={nearbyCenter}
          onSelectStop={(stop) => handleSelectStop(stop, true)}
          limit={isDesktop ? DESKTOP_NEARBY_LIMIT : NEARBY_LIST_LIMIT}
          linesPerStop={isDesktop ? DESKTOP_LINES_PER_STOP : NEARBY_LINES_PER_STOP}
          layout={isDesktop ? 'stacked' : 'inline'}
        />
        {pointHint.visible ? (
          <div className="mt-4 flex items-center gap-3 rounded-sm bg-surface-2 py-2 pr-2 pl-3 text-sm">
            <p className="min-w-0 flex-1">
              {isDesktop
                ? 'Quer ir para um ponto do mapa? Clique nele com o botão direito.'
                : 'Quer ir para um ponto do mapa? Toque e segure nele.'}
            </p>
            <button
              type="button"
              onClick={pointHint.dismiss}
              className="inline-flex h-11 shrink-0 items-center rounded-sm px-3 font-bold transition-colors hover:bg-surface"
            >
              Entendi
            </button>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <main className={SCREEN_CLASS}>
      <MapLayers>
        <VisibleCenterSync padding={padding} onChange={setVisibleCenter} />
        <MapLongPress
          onLongPress={(point) => {
            setPin(point);
            // Usou o recurso: a dica já cumpriu o papel.
            if (pointHint.visible) pointHint.dismiss();
          }}
        />
        <MapFlyTo target={flyTarget} />
        <RouteShapeLayer routeId={routeId} />
        <StopsLayer
          center={stopsCenter}
          selectedStopId={activeStop?.id}
          onSelectStop={(stop) => handleSelectStop(stop, false)}
        />
        <VehiclesLayer highlight={routeId ? { routeId, color: lineColor } : null} />
        <UserLocationLayer />
        {pin && pinPlace ? (
          <DroppedPin
            location={pin}
            title={pinPlace.name}
            subtitle={pinPlace.address}
            onClose={() => setPin(null)}
          >
            <PlaceActions place={pinPlace} />
          </DroppedPin>
        ) : null}
        <LocateButton
          className="right-3 md:right-6 md:bottom-6"
          // No celular fica logo acima do painel na altura baixa.
          {...(isDesktop ? {} : { style: { bottom: LOW_SNAP_PX + 12 } })}
        />
      </MapLayers>
      <StaleDataNotice />
      <AppPanel title="Mapa de São Paulo" titleHidden snap={snap} onSnapChange={setSnap}>
        {content}
      </AppPanel>
    </main>
  );
}
