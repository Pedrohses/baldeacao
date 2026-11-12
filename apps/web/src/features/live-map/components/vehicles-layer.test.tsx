import { vehicleSnapshotExample } from '@baldeacao/types/examples';
import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { initialMapState, useMapStore } from '../hooks/use-map-store';
import { useVehiclePositions } from '../hooks/use-vehicle-positions';
import { createFakeMap, type FakeMap } from './fake-map.test-utils';
import {
  VEHICLES_HEATMAP_LAYER_ID,
  VEHICLES_HIGHLIGHT_LAYER_ID,
  VEHICLES_LAYER_ID,
  VEHICLES_SOURCE_ID,
  VehiclesLayer,
} from './vehicles-layer';

const mapRef = vi.hoisted(() => ({ current: undefined as unknown }));

// Sem WebGL no jsdom: Source e Layer viram elementos que expõem as props.
vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ id, data, children }: { id: string; data: unknown; children?: ReactNode }) => (
    <div data-testid="source" data-id={id} data-geojson={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Layer: (props: {
    id: string;
    type: string;
    paint: unknown;
    layout?: unknown;
    filter?: unknown;
    minzoom?: number;
    maxzoom?: number;
  }) => (
    <div
      data-testid="layer"
      data-id={props.id}
      data-type={props.type}
      data-paint={JSON.stringify(props.paint)}
      data-layout={JSON.stringify(props.layout ?? null)}
      data-filter={JSON.stringify(props.filter ?? null)}
      data-minzoom={props.minzoom ?? ''}
      data-maxzoom={props.maxzoom ?? ''}
    />
  ),
  useMap: () => ({ current: mapRef.current }),
}));

vi.mock('../hooks/use-vehicle-positions', () => ({ useVehiclePositions: vi.fn() }));

const useVehiclePositionsMock = vi.mocked(useVehiclePositions);

function mockData(data: typeof vehicleSnapshotExample | undefined) {
  useVehiclePositionsMock.mockReturnValue({ data } as ReturnType<typeof useVehiclePositions>);
}

function layer(id: string) {
  const found = screen.getAllByTestId('layer').find((el) => el.getAttribute('data-id') === id);
  if (!found) throw new Error(`camada ${id} não renderizada`);
  return {
    el: found,
    type: found.getAttribute('data-type'),
    paint: JSON.parse(found.getAttribute('data-paint') ?? 'null'),
    layout: JSON.parse(found.getAttribute('data-layout') ?? 'null'),
    filter: JSON.parse(found.getAttribute('data-filter') ?? 'null'),
    minzoom: found.getAttribute('data-minzoom'),
    maxzoom: found.getAttribute('data-maxzoom'),
  };
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
    expect(layer(VEHICLES_LAYER_ID).type).toBe('circle');

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
      map.fire(`click:${VEHICLES_LAYER_ID}`, {
        features: [{ properties: { vehicleId: '11433', routeId: '875A-10' } }],
      });
    });

    expect(useMapStore.getState().selection).toEqual({
      kind: 'vehicle',
      vehicleId: '11433',
      routeId: '875A-10',
    });
    expect(layer(VEHICLES_LAYER_ID).el.getAttribute('data-paint')).toContain('"11433"');

    unmount();
    expect(map.listenerCount(`click:${VEHICLES_LAYER_ID}`)).toBe(0);
  });

  it('abaixo do zoom 13 vira heatmap e acima círculos da marca, com fade cruzado', () => {
    mockData(vehicleSnapshotExample);
    render(<VehiclesLayer />);

    const heat = layer(VEHICLES_HEATMAP_LAYER_ID);
    expect(heat.type).toBe('heatmap');
    expect(heat.maxzoom).toBe('13.5');
    expect(heat.layout).toEqual({ visibility: 'visible' });
    expect(heat.paint['heatmap-opacity']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      12.5,
      0.35,
      13.5,
      0,
    ]);
    expect(heat.paint['heatmap-radius']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      10,
      8,
      13,
      14,
    ]);
    expect(JSON.stringify(heat.paint['heatmap-color'])).toContain('rgba(199, 54, 31, 1)');

    const circles = layer(VEHICLES_LAYER_ID);
    expect(circles.minzoom).toBe('12.5');
    expect(circles.paint['circle-color']).toBe('#C7361F');
    expect(circles.paint['circle-stroke-color']).toEqual([
      'case',
      expect.anything(),
      '#2B1B14',
      '#FFFFFF',
    ]);
    expect(circles.paint['circle-opacity']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      12.5,
      0,
      13.5,
      1,
    ]);
    expect(JSON.stringify(circles.paint['circle-radius'])).toContain('2.5');
    expect(screen.queryAllByTestId('layer').map((l) => l.getAttribute('data-id'))).not.toContain(
      VEHICLES_HIGHLIGHT_LAYER_ID,
    );
  });

  it('com linha em destaque esconde o heatmap, esmaece os demais e pinta a linha', () => {
    mockData(vehicleSnapshotExample);
    render(<VehiclesLayer highlight={{ routeId: '875A-10', color: '#E3001B' }} />);

    expect(layer(VEHICLES_HEATMAP_LAYER_ID).layout).toEqual({ visibility: 'none' });
    const others = layer(VEHICLES_LAYER_ID);
    expect(others.paint['circle-opacity']).toBe(0.12);
    expect(others.minzoom).toBe('0');

    const line = layer(VEHICLES_HIGHLIGHT_LAYER_ID);
    expect(line.filter).toEqual(['==', ['get', 'routeId'], '875A-10']);
    expect(line.paint['circle-color']).toBe('#E3001B');
    expect(line.paint['circle-radius']).toEqual(['case', expect.anything(), 9, 7]);
    expect(line.paint['circle-stroke-width']).toEqual(['case', expect.anything(), 3, 2]);
    expect(map.listenerCount(`click:${VEHICLES_HIGHLIGHT_LAYER_ID}`)).toBe(1);
  });
});
