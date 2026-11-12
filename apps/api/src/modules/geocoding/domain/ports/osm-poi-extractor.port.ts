import type { OsmTags } from '../value-objects/osm-poi-category';

/** Objeto OSM extraído do recorte, com a geometria em GeoJSON (ponto ou área). */
export interface OsmPoiFeature {
  /** "node", "way" ou "relation". */
  osmType: string;
  osmId: number;
  tags: OsmTags;
  geometryGeoJson: string;
}

/** Extrai do arquivo .osm.pbf os objetos com as categorias de lugar importadas. */
export abstract class OsmPoiExtractor {
  abstract extract(pbfPath: string): Promise<OsmPoiFeature[]>;
}
