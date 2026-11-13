import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { TransitModule } from '../transit/transit.module';
import { ResolvePlaceAccessUseCase } from './application/use-cases/resolve-place-access.use-case';
import { ReversePlaceUseCase } from './application/use-cases/reverse-place.use-case';
import { SearchPlacesUseCase } from './application/use-cases/search-places.use-case';
import { GeocodeCache } from './domain/ports/geocode-cache.port';
import { Geocoder } from './domain/ports/geocoder.port';
import { KnownPlaceRepository } from './domain/ports/known-place-repository.port';
import { NominatimClient } from './infrastructure/adapters/nominatim.client';
import { NominatimGeocoderAdapter } from './infrastructure/adapters/nominatim-geocoder.adapter';
import { TypeormGeocodeCacheRepository } from './infrastructure/persistence/typeorm-geocode-cache.repository';
import { TypeormKnownPlaceRepository } from './infrastructure/persistence/typeorm-known-place.repository';
import { PlacesController } from './presentation/http/places.controller';

@Module({
  imports: [TransitModule],
  controllers: [PlacesController],
  providers: [
    SearchPlacesUseCase,
    ReversePlaceUseCase,
    ResolvePlaceAccessUseCase,
    {
      // Uma instância por processo: a fila de 1 req/s do Nominatim mora nela.
      provide: NominatimClient,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new NominatimClient({
          baseUrl: config.nominatimUrl,
          userAgent: config.nominatimUserAgent,
        }),
    },
    { provide: Geocoder, useClass: NominatimGeocoderAdapter },
    { provide: GeocodeCache, useClass: TypeormGeocodeCacheRepository },
    { provide: KnownPlaceRepository, useClass: TypeormKnownPlaceRepository },
  ],
  // Caso de uso exportado para o MCP (A4) e o contexto routing.
  exports: [SearchPlacesUseCase, ReversePlaceUseCase, ResolvePlaceAccessUseCase],
})
export class GeocodingModule {}
