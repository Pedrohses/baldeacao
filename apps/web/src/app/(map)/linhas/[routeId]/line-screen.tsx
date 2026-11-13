'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { LineHeader, RouteShapeLayer, addRecentLine, useLineDetails } from '@/features/lines';
import {
  StaleDataNotice,
  VehiclesLayer,
  useMapStore,
  useVehiclePositions,
} from '@/features/live-map';
import { AppPanel, type PanelSnap, SCREEN_CLASS, useMapPadding } from '@/shared/ui/app-shell';
import { ArrowLeftIcon } from '@/shared/ui/icons';
import { MapLayers, UserLocationLayer, useMapColors } from '@/shared/ui/map';

function vehiclesText(count: number): string {
  if (count === 0) return 'Nenhum ônibus desta linha circulando agora.';
  if (count === 1) return '1 ônibus ao vivo agora, em destaque no mapa.';
  return `${count} ônibus ao vivo agora, em destaque no mapa.`;
}

export interface LineScreenProps {
  /** route_id do GTFS, ex.: "875A-10". */
  routeId: string;
}

/** Página da linha: cabeçalho, traçado e os ônibus dela ao vivo em destaque. */
export function LineScreen({ routeId }: LineScreenProps) {
  const router = useRouter();
  const colors = useMapColors();
  const selectLine = useMapStore((state) => state.selectLine);
  const [snap, setSnap] = useState<PanelSnap>('mid');
  const padding = useMapPadding(snap);

  const line = useLineDetails(routeId);
  const vehicles = useVehiclePositions(routeId);
  // Sem cor no GTFS, o neutro de linha (a cor da marca é só para ação e seleção).
  const color = line.data?.line.color ? `#${line.data.line.color}` : colors.lineFallback;
  const loadedLine = line.data?.line;
  useEffect(() => {
    if (loadedLine) addRecentLine(loadedLine);
  }, [loadedLine]);
  const count = vehicles.data?.vehicles.length;
  const noLiveData = line.data?.line.type === 'subway' || line.data?.line.type === 'rail';

  function showOnMap() {
    selectLine(routeId);
    router.push('/');
  }

  let header;
  if (line.data) header = <LineHeader line={line.data.line} />;
  else if (line.isError) {
    header = (
      <p role="alert" className="text-danger">
        Não foi possível carregar a linha {routeId}.
      </p>
    );
  } else header = <p className="text-muted">Carregando a linha {routeId}...</p>;

  return (
    <main className={SCREEN_CLASS}>
      <MapLayers>
        <RouteShapeLayer routeId={routeId} fitPadding={padding} />
        <VehiclesLayer routeId={routeId} highlight={{ routeId, color }} />
        <UserLocationLayer />
      </MapLayers>
      <StaleDataNotice />
      <AppPanel title={`Linha ${routeId}`} titleHidden snap={snap} onSnapChange={setSnap}>
        <Link
          href="/linhas"
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-semibold text-muted transition-colors hover:text-text"
        >
          <ArrowLeftIcon className="size-4" />
          Todas as linhas
        </Link>
        <div className="mt-1">{header}</div>
        <p role="status" className="mt-3">
          {noLiveData
            ? 'Metrô e trem não têm posição ao vivo.'
            : count === undefined
              ? vehicles.isError
                ? 'Não foi possível ver os ônibus ao vivo agora.'
                : 'Procurando os ônibus da linha...'
              : vehiclesText(count)}
        </p>
        {line.data && line.data.shapes.length > 1 ? (
          <p className="mt-1 text-sm text-muted">Ida em linha contínua, volta tracejada.</p>
        ) : null}
        <button
          type="button"
          onClick={showOnMap}
          className="mt-4 inline-flex h-11 items-center justify-center rounded-sm bg-brand px-4 font-bold text-brand-fg"
        >
          Ver no mapa
        </button>
      </AppPanel>
    </main>
  );
}
