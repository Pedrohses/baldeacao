import { vehicleSnapshotExample } from '@baldeacao/types/examples';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { initialMapState, useMapStore } from '../hooks/use-map-store';
import { useVehiclePositions } from '../hooks/use-vehicle-positions';
import { createFakeMap, type FakeMap } from './fake-map.test-utils';
import { VEHICLES_LAYER_ID, VEHICLES_SOURCE_ID, VehiclesLayer } from './vehicles-layer';

const mapRef = vi.hoisted(() => ({ current: undefined as unknown }));

// Sem WebGL no jsdom: Source e Layer viram elementos que expõem as props.
vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ id, data, children }: { id: string; data: unknown; children?: ReactNode }) => (
    <div data-testid="source" data-id={id} data-geojson={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Layer: ({ id, type, paint }: { id: string; type: string; paint: unknown }) => (
    <div data-testid="layer" data-id={id} data-type={type} data-paint={JSON.stringify(paint)} />
  ),
  useMap: () => ({ current: mapRef.current }),
}));

vi.mock('../hooks/use-vehicle-positions', () => ({ useVehiclePositions: vi.fn() }));

const useVehiclePositionsMock = vi.mocked(useVehiclePositions);

function mockData(data: typeof vehicleSnapshotExample | undefined) {
  useVehiclePositionsMock.mockReturnValue({ data } as ReturnType<typeof useVehiclePositions>);
}

function renderedGeoJson() {
  return JSON.parse(screen.getByTestId('source').getAttribute('data-geojson') ?? 'null');
}

describe('VehiclesLayer', () => {
  let map: FakeMap;

  beforeEach(() => {
    useMapStore.setState(initialMapState);
    map = createFakeMap();
    mapRef.current = map;
  });

  it('renderiza os veículos da fixture como pontos GeoJSON', () => {
    mockData(vehicleSnapshotExample);
    render(<VehiclesLayer routeId="875A-10" />);

    expect(useVehiclePositionsMock).toHaveBeenCalledWith('875A-10');
    expect(screen.getByTestId('source')).toHaveAttribute('data-id', VEHICLES_SOURCE_ID);
    expect(screen.getByTestId('layer')).toHaveAttribute('data-id', VEHICLES_LAYER_ID);
    expect(screen.getByTestId('layer')).toHaveAttribute('data-type', 'circle');

    const geojson = renderedGeoJson();
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]).toMatchObject({
      id: '11433',
      geometry: { type: 'Point', coordinates: [-46.6612, -23.559] },
      properties: { vehicleId: '11433', routeShortName: '875A-10' },
    });
  });

  it('renderiza a fonte vazia enquanto o snapshot carrega', () => {
    mockData(undefined);
    render(<VehiclesLayer />);

    expect(renderedGeoJson()).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('leva o updatedAt do snapshot para o store', () => {
    mockData(vehicleSnapshotExample);
    render(<VehiclesLayer />);

    expect(useMapStore.getState().dataUpdatedAt).toBe(vehicleSnapshotExample.updatedAt);
  });

  it('seleciona o veículo clicado e o destaca na camada', () => {
    mockData(vehicleSnapshotExample);
    const { unmount } = render(<VehiclesLayer />);

    act(() => {
      map.fire(`click:${VEHICLES_LAYER_ID}`, { features: [{ properties: { vehicleId: '11433' } }] });
    });

    expect(useMapStore.getState().selection).toEqual({ kind: 'vehicle', vehicleId: '11433' });
    expect(screen.getByTestId('layer').getAttribute('data-paint')).toContain('"11433"');

    unmount();
    expect(map.listenerCount(`click:${VEHICLES_LAYER_ID}`)).toBe(0);
  });
});
