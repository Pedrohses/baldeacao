import { describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';

import { MAP_TINTS, tintStyle, tintTargetsFor } from './map-tint';

describe('tintTargetsFor', () => {
  it('pinta fundo, água, parque, prédio, vias e rótulos', () => {
    expect(tintTargetsFor({ id: 'background', type: 'background' })).toEqual([
      { property: 'background-color', color: 'land' },
    ]);
    expect(tintTargetsFor({ id: 'water', type: 'fill', 'source-layer': 'water' })[0]?.color).toBe(
      'water',
    );
    expect(
      tintTargetsFor({ id: 'landuse_park', type: 'fill', 'source-layer': 'landuse' })[0]?.color,
    ).toBe('park');
    expect(
      tintTargetsFor({ id: 'building', type: 'fill', 'source-layer': 'building' })[0]?.color,
    ).toBe('building');
    expect(
      tintTargetsFor({
        id: 'highway_major_casing',
        type: 'line',
        'source-layer': 'transportation',
      })[0]?.color,
    ).toBe('roadCasing');
    expect(
      tintTargetsFor({ id: 'highway_minor', type: 'line', 'source-layer': 'transportation' })[0]
        ?.color,
    ).toBe('road');
    expect(
      tintTargetsFor({ id: 'label_city', type: 'symbol', 'source-layer': 'place' }).map(
        (t) => t.property,
      ),
    ).toEqual(['text-color', 'text-halo-color']);
  });

  it('pinta pistas de aeroporto (pretas no estilo escuro)', () => {
    expect(
      tintTargetsFor({ id: 'aeroway-runway', type: 'line', 'source-layer': 'aeroway' })[0]?.color,
    ).toBe('roadCasing');
    expect(
      tintTargetsFor({ id: 'aeroway-area', type: 'fill', 'source-layer': 'aeroway' })[0]?.color,
    ).toBe('building');
  });

  it('não mexe em camadas que não conhece', () => {
    expect(tintTargetsFor({ id: 'boundary_2', type: 'line', 'source-layer': 'boundary' })).toEqual(
      [],
    );
    expect(tintTargetsFor({ id: 'live-map-vehicles', type: 'circle' })).toEqual([]);
  });
});

describe('tintStyle', () => {
  it('aplica a paleta do tema e ignora propriedade recusada', () => {
    const setPaintProperty = vi.fn((id: string) => {
      if (id === 'background') throw new Error('recusada');
    });
    const layers: Record<string, { type: string; sourceLayer?: string }> = {
      background: { type: 'background' },
      water: { type: 'fill', sourceLayer: 'water' },
    };
    const map = {
      getLayersOrder: () => Object.keys(layers),
      getLayer: (id: string) => layers[id],
      setPaintProperty,
    } as unknown as MapLibreMap;

    tintStyle(map, 'dark');

    expect(setPaintProperty).toHaveBeenCalledWith('water', 'fill-color', MAP_TINTS.dark.water);
  });
});
