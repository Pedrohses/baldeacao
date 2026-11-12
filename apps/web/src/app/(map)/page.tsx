import {
  DEFAULT_MAP_VIEWPORT,
  MapViewportSync,
  StaleDataNotice,
  VehiclesLayer,
} from '@/features/live-map';
import { BaseMap } from '@/shared/ui/map';

export default function MapPage() {
  return (
    <main className="relative h-dvh w-full">
      <h1 className="sr-only">Baldeação - mapa de São Paulo</h1>
      <BaseMap initialViewState={DEFAULT_MAP_VIEWPORT}>
        <MapViewportSync />
        <VehiclesLayer />
      </BaseMap>
      <StaleDataNotice />
    </main>
  );
}
