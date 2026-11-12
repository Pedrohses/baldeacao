import { Module } from '@nestjs/common';
import { ImportKnownPlacesUseCase } from './application/use-cases/import-known-places.use-case';
import { KnownPlaceRepository } from './domain/ports/known-place-repository.port';
import { OsmPoiExtractor } from './domain/ports/osm-poi-extractor.port';
import { OsmiumPoiExtractorAdapter } from './infrastructure/adapters/osmium-poi-extractor.adapter';
import { TypeormKnownPlaceRepository } from './infrastructure/persistence/typeorm-known-place.repository';

/** Importação de lugares conhecidos do OSM, só para o CLI (sem Nominatim nem transit). */
@Module({
  providers: [
    ImportKnownPlacesUseCase,
    { provide: OsmPoiExtractor, useClass: OsmiumPoiExtractorAdapter },
    { provide: KnownPlaceRepository, useClass: TypeormKnownPlaceRepository },
  ],
  exports: [ImportKnownPlacesUseCase],
})
export class PlacesImportModule {}
