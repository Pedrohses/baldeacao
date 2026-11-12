'use client';

import type { TripRequest } from '@baldeacao/types';
import Link from 'next/link';
import { useState } from 'react';

import { DEFAULT_MAP_VIEWPORT } from '@/features/live-map';
import { PlaceAutocomplete } from '@/features/place-search';
import {
  ItineraryLayer,
  ItineraryList,
  TripForm,
  type ItineraryListStatus,
  type RenderPlaceInput,
  useTripPlan,
} from '@/features/trip-planner';
import { BaseMap } from '@/shared/ui/map';

// Composição: o TripForm recebe o campo de lugar daqui porque features não se importam.
const renderPlaceInput: RenderPlaceInput = (props) => <PlaceAutocomplete {...props} />;

/** Tela de planejamento: painel com formulário e itinerários sobre o mapa. */
export function TripScreen() {
  const [request, setRequest] = useState<TripRequest | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const plan = useTripPlan(request);

  const status: ItineraryListStatus = !request
    ? 'idle'
    : plan.isPending
      ? 'loading'
      : plan.isError
        ? 'error'
        : 'success';
  const itineraries = plan.data ?? [];
  const selected = status === 'success' ? (itineraries[selectedIndex] ?? null) : null;

  function handleSubmit(next: TripRequest) {
    setRequest(next);
    setSelectedIndex(0);
  }

  return (
    <main className="relative h-dvh w-full">
      <BaseMap initialViewState={DEFAULT_MAP_VIEWPORT}>
        <ItineraryLayer itinerary={selected} />
      </BaseMap>
      <div className="absolute inset-x-0 bottom-0 max-h-[65dvh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-lg md:inset-x-auto md:top-4 md:bottom-auto md:left-4 md:max-h-[calc(100dvh-2rem)] md:w-96 md:rounded-2xl">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">Planejar viagem</h1>
          <Link
            href="/"
            className="rounded text-sm font-medium text-blue-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
          >
            Voltar ao mapa
          </Link>
        </header>
        <TripForm
          renderPlaceInput={renderPlaceInput}
          onSubmit={handleSubmit}
          isSubmitting={status === 'loading'}
        />
        <div className="mt-4">
          <ItineraryList
            status={status}
            itineraries={itineraries}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            {...(plan.error ? { errorMessage: plan.error.message } : {})}
          />
        </div>
      </div>
    </main>
  );
}
