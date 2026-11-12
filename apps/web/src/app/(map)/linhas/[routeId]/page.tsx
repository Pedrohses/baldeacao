import type { Metadata } from 'next';

import { LineScreen } from './line-screen';

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/linhas/[routeId]'>): Promise<Metadata> {
  const { routeId } = await params;
  return {
    title: `Linha ${decodeParam(routeId)} | Baldeação`,
    description: 'Traçado da linha e os ônibus dela ao vivo no mapa.',
  };
}

export default async function LinePage({ params }: PageProps<'/linhas/[routeId]'>) {
  const { routeId } = await params;
  const id = decodeParam(routeId);
  return <LineScreen key={id} routeId={id} />;
}
