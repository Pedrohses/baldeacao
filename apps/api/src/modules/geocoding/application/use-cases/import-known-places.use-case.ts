import { Injectable } from '@nestjs/common';
import {
  type KnownPlaceRecord,
  KnownPlaceRepository,
} from '../../domain/ports/known-place-repository.port';
import { type OsmPoiFeature, OsmPoiExtractor } from '../../domain/ports/osm-poi-extractor.port';
import {
  classifyOsmPoi,
  osmPoiAddress,
  osmPoiAliases,
} from '../../domain/value-objects/osm-poi-category';
import {
  SERVICE_CITY_ADMIN_LEVEL,
  SERVICE_CITY_NAME,
  SERVICE_CITY_NEIGHBOURHOOD_ALIASES,
} from '../../domain/value-objects/service-city';

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
  /** Se o limite do município atendido veio no arquivo (sem ele, ninguém é penalizado). */
  cityBoundary: boolean;
  durationMs: number;
}

/** Limite do município atendido: relação boundary=administrative, admin_level=8, com o nome. */
function isServiceCityBoundary(feature: OsmPoiFeature): boolean {
  const { tags } = feature;
  return (
    feature.osmType === 'relation' &&
    tags.boundary === 'administrative' &&
    tags.admin_level === SERVICE_CITY_ADMIN_LEVEL &&
    tags.name === SERVICE_CITY_NAME
  );
}

/**
 * Importa os lugares conhecidos do OSM e o limite do município atendido, substituindo os
 * anteriores numa transação.
 */
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
    let cityBoundary: string | null = null;
    for (const feature of features) {
      if (!cityBoundary && isServiceCityBoundary(feature)) {
        cityBoundary = feature.geometryGeoJson;
        continue;
      }
      const name = feature.tags.name?.trim().replace(/\s+/g, ' ');
      const category = name ? classifyOsmPoi(feature.tags) : null;
      if (!name || !category) continue;
      const id = `osm:${feature.osmType}:${feature.osmId}`;
      if (records.has(id)) continue;
      records.set(id, {
        id,
        name,
        category: category.category,
        kind: category.kind,
        importance: category.importance,
        aliases: [
          ...osmPoiAliases(feature.tags),
          ...(category.kind === 'address' ? (SERVICE_CITY_NEIGHBOURHOOD_ALIASES[name] ?? []) : []),
        ],
        ...osmPoiAddress(feature.tags),
        geometryGeoJson: feature.geometryGeoJson,
      });
    }
    const imported = await this.places.replaceAll([...records.values()], cityBoundary);
    return {
      extracted: features.length,
      imported,
      skipped: features.length - records.size - (cityBoundary ? 1 : 0),
      cityBoundary: cityBoundary !== null,
      durationMs: Date.now() - startedAt,
    };
  }
}
