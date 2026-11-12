import type { Metadata } from 'next';

import { TripScreen } from './trip-screen';

export const metadata: Metadata = {
  title: 'Planejar viagem | Baldeação',
  description: 'Planeje sua viagem de transporte público em São Paulo, com ônibus, metrô e trem.',
};

export default function TripPage() {
  return <TripScreen />;
}
