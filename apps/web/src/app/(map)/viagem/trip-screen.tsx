'use client';

import type { Place } from '@baldeacao/types';
import { useEffect, useState } from 'react';

import { PlaceAutocomplete, useResolveMapPoint } from '@/features/place-search';
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
import { AppPanel, type PanelSnap, SCREEN_CLASS, useMapPadding } from '@/shared/ui/app-shell';
import { CenterPicker, MapLayers, UserLocationLayer } from '@/shared/ui/map';
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
  // "Minha localização" vinda da URL: buscando, ou falhou (permissão negada ou sem GPS).
  const gpsField: TripField | null =
    initial.origin === 'current-location'
      ? 'origin'
      : initial.destination === 'current-location'
        ? 'destination'
        : null;
  const [geo, setGeo] = useState<{ field: TripField; status: 'locating' | 'failed' } | null>(() =>
    gpsField ? { field: gpsField, status: 'locating' } : null,
  );
  const padding = useMapPadding(snap);
  const resolveMapPoint = useResolveMapPoint();

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
    const field = gpsField;
    if (!field) return;
    let cancelled = false;
    void locate().then((position) => {
      if (cancelled) return;
      if (!position) {
        // Nunca deixar a ponta vazia em silêncio: avisa e põe o foco no campo.
        setGeo({ field, status: 'failed' });
        setFocusRequest((previous) => ({ field, key: (previous?.key ?? 0) + 1 }));
        return;
      }
      setGeo(null);
      const place = currentLocationPlace(position);
      if (field === 'origin') setOrigin(place);
      else setDestination(place);
    });
    return () => {
      cancelled = true;
    };
  }, [gpsField, setOrigin, setDestination]);

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
  // O aviso do GPS some quando a pessoa escolhe a ponta de outro jeito.
  const geoPending = geo && !(geo.field === 'origin' ? trip.origin : trip.destination) ? geo : null;

  function startPicking(field: TripField) {
    setPicking(field);
    setSnap('low');
  }

  function confirmPick(location: { lat: number; lon: number }) {
    // "Ponto no mapa" na hora; o nome do lugar mais próximo chega da busca reversa.
    const place = coordinatesPlace(location);
    const set = picking === 'origin' ? setOrigin : setDestination;
    set(place);
    setPicking(null);
    setSnap('mid');
    void resolveMapPoint(location).then((named) =>
      set((current) => (current?.id === place.id ? named : current)),
    );
  }

  return (
    <main className={SCREEN_CLASS}>
      <MapLayers>
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
      </MapLayers>
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
          {geoPending?.status === 'locating' ? (
            <p role="status" className="mt-2 text-sm text-muted">
              Buscando sua localização...
            </p>
          ) : null}
          {geoPending?.status === 'failed' ? (
            <p
              role="alert"
              className="mt-2 rounded-md border border-warn/40 bg-warn/10 p-3 text-sm"
            >
              {geoPending.field === 'origin'
                ? 'Não conseguimos sua localização. Ative a permissão ou escolha a origem.'
                : 'Não conseguimos sua localização. Ative a permissão ou escolha o destino.'}
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <TimeChip
            value={trip.time}
            onChange={trip.setTime}
            open={timeOpen}
            onOpenChange={setTimeOpen}
            now={now}
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
