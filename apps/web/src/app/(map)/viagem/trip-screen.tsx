'use client';

import type { Place } from '@baldeacao/types';
import { useEffect, useState } from 'react';

import { MapViewportSync, useMapStore } from '@/features/live-map';
import { PlaceAutocomplete } from '@/features/place-search';
import {
  ItineraryLayer,
  ItineraryList,
  type ItineraryListStatus,
  ItineraryTimeline,
  type ParsedTripParams,
  type RenderPlaceInput,
  TimeChip,
  type TripEndpoint,
  type TripField,
  TripForm,
  useTripPlan,
  useTripRequest,
} from '@/features/trip-planner';
import { locate } from '@/shared/hooks/use-geolocation';
import { useIsDesktop } from '@/shared/hooks/use-media-query';
import { useNow } from '@/shared/hooks/use-now';
import { AppPanel, type PanelSnap, useMapPadding } from '@/shared/ui/app-shell';
import { BaseMap, CenterPicker, UserLocationLayer } from '@/shared/ui/map';
import { coordinatesPlace, currentLocationPlace } from '@/shared/utils/place';

// Composição: o TripForm recebe o campo de lugar daqui porque features não se importam.
const renderPlaceInput: RenderPlaceInput = (props) => <PlaceAutocomplete {...props} />;

function asPlace(endpoint: TripEndpoint | null): Place | null {
  return endpoint && endpoint !== 'current-location' ? endpoint : null;
}

export interface TripScreenProps {
  /** Origem, destino e foco lidos da URL (`de`, `para`, `foco`). */
  initial: ParsedTripParams;
}

/** Tela de planejamento: cartão de origem e destino, hora e itinerários no painel, rota no mapa. */
export function TripScreen({ initial }: TripScreenProps) {
  const isDesktop = useIsDesktop();
  const viewport = useMapStore((state) => state.viewport);
  const now = useNow(30_000);
  const trip = useTripRequest({
    initialOrigin: asPlace(initial.origin),
    initialDestination: asPlace(initial.destination),
  });
  const { setOrigin, setDestination } = trip;
  const plan = useTripPlan(trip.request);

  const [snap, setSnap] = useState<PanelSnap>(initial.destination ? 'mid' : 'high');
  const [picking, setPicking] = useState<TripField | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ field: TripField; key: number } | null>(null);
  const padding = useMapPadding(snap);

  // Seleção (itinerário e trecho em foco) volta ao começo a cada pedido novo.
  const requestKey = trip.request ? JSON.stringify(trip.request) : '';
  const [selection, setSelection] = useState({
    key: requestKey,
    index: 0,
    leg: null as number | null,
  });
  const current =
    selection.key === requestKey ? selection : { key: requestKey, index: 0, leg: null };

  // "Minha localização" vinda da URL: resolve pelo GPS ao abrir.
  useEffect(() => {
    const field: TripField | null =
      initial.origin === 'current-location'
        ? 'origin'
        : initial.destination === 'current-location'
          ? 'destination'
          : null;
    if (!field) return;
    let cancelled = false;
    void locate().then((position) => {
      if (cancelled || !position) return;
      const place = currentLocationPlace(position);
      if (field === 'origin') setOrigin(place);
      else setDestination(place);
    });
    return () => {
      cancelled = true;
    };
  }, [initial.origin, initial.destination, setOrigin, setDestination]);

  const status: ItineraryListStatus = !trip.request
    ? 'idle'
    : plan.isPending
      ? 'loading'
      : plan.isError
        ? 'error'
        : 'success';
  const itineraries = plan.data?.itineraries ?? [];
  const notices = status === 'success' ? (plan.data?.notices ?? []) : [];
  const selected = status === 'success' ? (itineraries[current.index] ?? null) : null;

  function startPicking(field: TripField) {
    setPicking(field);
    setSnap('low');
  }

  function confirmPick(location: { lat: number; lon: number }) {
    const place = coordinatesPlace(location);
    if (picking === 'origin') setOrigin(place);
    else setDestination(place);
    setPicking(null);
    setSnap('mid');
  }

  return (
    <main className="relative h-full w-full">
      <BaseMap initialViewState={viewport} showNavigation={isDesktop}>
        <MapViewportSync />
        <UserLocationLayer />
        <ItineraryLayer itinerary={selected} focusedLeg={current.leg} fitPadding={padding} />
        {picking ? (
          <CenterPicker
            instruction={
              picking === 'origin'
                ? 'Arraste o mapa até a origem e confirme.'
                : 'Arraste o mapa até o destino e confirme.'
            }
            onConfirm={confirmPick}
            onCancel={() => setPicking(null)}
          />
        ) : null}
      </BaseMap>
      <AppPanel title="Planejar viagem" titleHidden={!isDesktop} snap={snap} onSnapChange={setSnap}>
        <div onFocusCapture={() => !isDesktop && setSnap('high')}>
          <TripForm
            renderPlaceInput={renderPlaceInput}
            origin={trip.origin}
            destination={trip.destination}
            onOriginChange={trip.setOrigin}
            onDestinationChange={trip.setDestination}
            onSwap={trip.swap}
            autoFocus={initial.focus}
            onPickOnMap={startPicking}
            error={trip.error}
            focusRequest={focusRequest}
          />
        </div>
        <div className="mt-3">
          <TimeChip
            value={trip.time}
            onChange={trip.setTime}
            open={timeOpen}
            onOpenChange={setTimeOpen}
          />
        </div>
        <div className="mt-4">
          {status === 'idle' && !trip.error ? (
            <p className="text-muted">Escolha a origem e o destino para ver as rotas.</p>
          ) : null}
          <ItineraryList
            status={status}
            itineraries={itineraries}
            selectedIndex={current.index}
            onSelect={(index) => {
              setSelection({ key: requestKey, index, leg: null });
              if (!isDesktop) setSnap('mid');
            }}
            now={now}
            onRetry={() => void plan.refetch()}
            onChangeTime={() => setTimeOpen(true)}
            onSwap={trip.swap}
            notices={notices}
            onEditField={(field) => {
              setFocusRequest((previous) => ({ field, key: (previous?.key ?? 0) + 1 }));
              if (!isDesktop) setSnap('high');
            }}
            {...(plan.error ? { errorMessage: plan.error.message } : {})}
          />
        </div>
        {selected ? (
          <section aria-labelledby="trip-details-title" className="mt-5">
            <h2 id="trip-details-title" className="mb-2 text-base font-bold">
              Detalhes da opção {current.index + 1}
            </h2>
            <ItineraryTimeline
              itinerary={selected}
              focusedLeg={current.leg}
              onFocusLeg={(leg) => setSelection({ key: requestKey, index: current.index, leg })}
              {...(trip.destination ? { destinationName: trip.destination.name } : {})}
            />
          </section>
        ) : null}
      </AppPanel>
    </main>
  );
}
