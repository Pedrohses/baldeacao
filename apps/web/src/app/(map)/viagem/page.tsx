import type { Metadata } from 'next';

import { parseTripSearchParams } from '@/features/trip-planner';

import { TripScreen } from './trip-screen';

export const metadata: Metadata = {
  title: 'Planejar viagem | Baldeação',
  description: 'Planeje sua viagem de transporte público em São Paulo, com ônibus, metrô e trem.',
};

export default async function TripPage({ searchParams }: PageProps<'/viagem'>) {
  const params = await searchParams;
  // A chave remonta a tela quando se chega por outro link (ex.: "Ir para cá" no mapa).
  return <TripScreen key={JSON.stringify(params)} initial={parseTripSearchParams(params)} />;
}
