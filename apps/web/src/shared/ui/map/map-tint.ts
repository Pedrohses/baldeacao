import type { Map as MapLibreMap } from 'maplibre-gl';

import type { MapTheme } from './map-colors';

/**
 * Paleta do mapa base: o positron e o dark do OpenFreeMap são cinza-azulados e brigam com a
 * paleta quente do app. Aquece o fundo em tempo de carga, sem trocar de provedor nem de tiles.
 * A água fica esverdeada e dessaturada para não competir com a cor das linhas.
 */
export interface MapTint {
  land: string;
  water: string;
  park: string;
  road: string;
  roadCasing: string;
  building: string;
  label: string;
  labelHalo: string;
}

export const MAP_TINTS: Record<MapTheme, MapTint> = {
  light: {
    land: '#F6F0E8',
    water: '#CFDCDC',
    park: '#E4EAD6',
    road: '#FFFFFF',
    roadCasing: '#E3D6C9',
    building: '#EDE3D8',
    label: '#7A6558',
    labelHalo: '#F6F0E8',
  },
  dark: {
    land: '#1E1714',
    water: '#14201F',
    park: '#1E261A',
    road: '#2E2520',
    roadCasing: '#3A2F28',
    building: '#261E1A',
    label: '#9C877A',
    labelHalo: '#1E1714',
  },
};

type PaintProperty = Parameters<MapLibreMap['setPaintProperty']>[1];

interface PaintTarget {
  property: PaintProperty;
  color: keyof MapTint;
}

interface StyleLayerLike {
  id: string;
  type: string;
  'source-layer'?: string;
}

/** Qual cor de pintura cada camada do estilo recebe; null mantém a do estilo. */
export function tintTargetsFor(layer: StyleLayerLike): PaintTarget[] {
  const { id, type } = layer;
  const sourceLayer = layer['source-layer'] ?? '';
  if (type === 'background') return [{ property: 'background-color', color: 'land' }];
  // Pistas e pátios de aeroporto: no estilo escuro vêm em preto puro e viram uma barra no mapa.
  if (sourceLayer === 'aeroway') {
    if (type === 'fill') return [{ property: 'fill-color', color: 'building' }];
    if (type === 'line') return [{ property: 'line-color', color: 'roadCasing' }];
    return [];
  }
  if (type === 'fill') {
    if (sourceLayer === 'water') return [{ property: 'fill-color', color: 'water' }];
    if (sourceLayer === 'park' || /park|wood|grass/.test(id)) {
      return [{ property: 'fill-color', color: 'park' }];
    }
    if (sourceLayer === 'building') return [{ property: 'fill-color', color: 'building' }];
    if (id === 'landuse_residential' || id === 'road_area_pier') {
      return [{ property: 'fill-color', color: 'land' }];
    }
    return [];
  }
  if (type === 'line') {
    if (sourceLayer === 'waterway') return [{ property: 'line-color', color: 'water' }];
    if (sourceLayer !== 'transportation') return [];
    if (/casing/.test(id) || (/^railway/.test(id) && !/dash/.test(id))) {
      return [{ property: 'line-color', color: 'roadCasing' }];
    }
    if (/dash|pier/.test(id)) return [{ property: 'line-color', color: 'land' }];
    if (/^highway/.test(id) || /^tunnel/.test(id))
      return [{ property: 'line-color', color: 'road' }];
    return [];
  }
  if (type === 'symbol' && (sourceLayer === 'place' || sourceLayer === 'transportation_name')) {
    return [
      { property: 'text-color', color: 'label' },
      { property: 'text-halo-color', color: 'labelHalo' },
    ];
  }
  return [];
}

/**
 * Aplica a paleta quente às camadas de fundo do estilo. Idempotente e barato (não serializa o
 * estilo): pode rodar a cada `styledata`, e repetir o mesmo valor não gera nova pintura.
 */
export function tintStyle(map: MapLibreMap, theme: MapTheme): void {
  const tint = MAP_TINTS[theme];
  for (const id of map.getLayersOrder()) {
    const layer = map.getLayer(id);
    if (!layer) continue;
    const targets = tintTargetsFor({
      id,
      type: layer.type,
      ...(layer.sourceLayer ? { 'source-layer': layer.sourceLayer } : {}),
    });
    for (const target of targets) {
      try {
        map.setPaintProperty(id, target.property, tint[target.color]);
      } catch {
        // Propriedade que a camada não aceita: mantém a cor original do estilo.
      }
    }
  }
}
