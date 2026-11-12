import { VehiclesLayer } from '@/features/live-map';
import { BaseMap, type MapViewState } from '@/shared/ui/map';

// Centro de São Paulo (Praça da Sé).
const SAO_PAULO_VIEW: MapViewState = {
  longitude: -46.6339,
  latitude: -23.5503,
  zoom: 11,
};

export default function MapPage() {
  return (
    <main className="h-dvh w-full">
      <h1 className="sr-only">Baldeação - mapa de São Paulo</h1>
      <BaseMap initialViewState={SAO_PAULO_VIEW}>
        <VehiclesLayer />
      </BaseMap>
    </main>
  );
}
