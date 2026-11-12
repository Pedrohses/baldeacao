import { Injectable } from '@nestjs/common';
import {
  type KnownPlaceRecord,
  KnownPlaceRepository,
} from '../../domain/ports/known-place-repository.port';
import { OsmPoiExtractor } from '../../domain/ports/osm-poi-extractor.port';
import { classifyOsmPoi, osmPoiAddress } from '../../domain/value-objects/osm-poi-category';

export interface ImportKnownPlacesInput {
  /** Caminho absoluto do recorte .osm.pbf. */
  pbfPath: string;
}

export interface ImportKnownPlacesOutput {
  /** Objetos extraídos do arquivo. */
  extracted: number;
  imported: number;
  /** Sem nome ou fora das categorias (ex.: nós referenciados pelas áreas). */
  skipped: number;
  durationMs: number;
}

/** Importa os lugares conhecidos do OSM, substituindo os anteriores numa transação. */
@Injectable()
export class ImportKnownPlacesUseCase {
  constructor(
    private readonly extractor: OsmPoiExtractor,
    private readonly places: KnownPlaceRepository,
  ) {}

  async execute(input: ImportKnownPlacesInput): Promise<ImportKnownPlacesOutput> {
    const startedAt = Date.now();
    const features = await this.extractor.extract(input.pbfPath);
    const records = new Map<string, KnownPlaceRecord>();
    for (const feature of features) {
      const name = feature.tags.name?.trim().replace(/\s+/g, ' ');
      const category = name ? classifyOsmPoi(feature.tags) : null;
      if (!name || !category) continue;
      const id = `osm:${feature.osmType}:${feature.osmId}`;
      if (records.has(id)) continue;
      records.set(id, {
        id,
        name,
        category: category.category,
        importance: category.importance,
        ...osmPoiAddress(feature.tags),
        geometryGeoJson: feature.geometryGeoJson,
      });
    }
    const imported = await this.places.replaceAll([...records.values()]);
    return {
      extracted: features.length,
      imported,
      skipped: features.length - records.size,
      durationMs: Date.now() - startedAt,
    };
  }
}
