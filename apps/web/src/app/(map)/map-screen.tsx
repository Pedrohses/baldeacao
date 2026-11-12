'use client';

import type { Coordinates, Place, Stop } from '@baldeacao/types';
import Link from 'next/link';
import { useState } from 'react';

import { LineHeader, RouteShapeLayer, useLineDetails } from '@/features/lines';
import { MapViewportSync, StaleDataNotice, VehiclesLayer, useMapStore } from '@/features/live-map';
import { PlaceKindIcon, useMapPointPlace, useRecentPlaces } from '@/features/place-search';
import { NearbyStopsList, STOPS_MIN_ZOOM, StopSheet, StopsLayer } from '@/features/stops';
import { buildTripHref } from '@/features/trip-planner';
import { useGeolocation } from '@/shared/hooks/use-geolocation';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { AppPanel, LOW_SNAP_PX, type PanelSnap } from '@/shared/ui/app-shell';
import { CloseIcon, SearchIcon } from '@/shared/ui/icons';
import {
  BaseMap,
  DroppedPin,
  LocateButton,
  MAP_COLORS,
  MapFlyTo,
  MapLongPress,
  UserLocationLayer,
} from '@/shared/ui/map';

const RECENT_CHIPS = 3;
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

  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [flyTarget, setFlyTarget] = useState<Coordinates | null>(null);
  const [snap, setSnap] = useState<PanelSnap>('low');
  const pinPlace = useMapPointPlace(pin).place;

  const activeStop =
    selection?.kind === 'stop' && selectedStop?.id === selection.stopId ? selectedStop : null;
  const routeId = selection?.kind === 'vehicle' ? selection.routeId : null;
  const line = useLineDetails(routeId);
  const lineColor = line.data?.line.color ? `#${line.data.line.color}` : MAP_COLORS.brand;

  const stopsCenter =
    viewport.zoom >= STOPS_MIN_ZOOM ? { lat: viewport.latitude, lon: viewport.longitude } : null;
  const nearbyCenter = position
    ? roundCenter(position.lat, position.lon)
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
        actions={<PlaceActions place={stopPlace(activeStop)} />}
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
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-2"
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
          className="flex h-14 items-center gap-3 rounded-md bg-surface-2 px-4 text-xl font-bold"
        >
          <SearchIcon className="size-6 text-muted" />
          Para onde?
        </Link>
        {recents.length > 0 ? (
          <ul aria-label="Destinos recentes" className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {recents.slice(0, RECENT_CHIPS).map((place) => (
              <li key={place.id} className="shrink-0">
                <Link
                  href={buildTripHref({ from: 'current-location', to: place })}
                  className="inline-flex h-11 max-w-56 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-bold"
                >
                  <PlaceKindIcon kind={place.kind} className="size-4 shrink-0 text-muted" />
                  <span className="truncate">{place.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <h2 className="mt-5 mb-1 text-base font-bold">
          {position ? 'Paradas perto de você' : 'Paradas perto do centro do mapa'}
        </h2>
        <NearbyStopsList
          center={nearbyCenter}
          onSelectStop={(stop) => handleSelectStop(stop, true)}
        />
        <p className="mt-4 text-sm text-muted">
          {isDesktop
            ? 'Clique com o botão direito no mapa para sair ou ir até um ponto.'
            : 'Toque e segure no mapa para sair ou ir até um ponto.'}
        </p>
      </>
    );
  }

  return (
    <main className="relative h-full w-full">
      <BaseMap initialViewState={viewport} showNavigation={isDesktop}>
        <MapViewportSync />
        <MapLongPress onLongPress={setPin} />
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
      </BaseMap>
      <StaleDataNotice />
      <AppPanel title="Mapa de São Paulo" titleHidden snap={snap} onSnapChange={setSnap}>
        {content}
      </AppPanel>
    </main>
  );
}
