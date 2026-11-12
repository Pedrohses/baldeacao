import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { SearchPlacesUseCase } from './application/use-cases/search-places.use-case';
import { GeocodeCache } from './domain/ports/geocode-cache.port';
import { Geocoder } from './domain/ports/geocoder.port';
import { NominatimClient } from './infrastructure/adapters/nominatim.client';
import { NominatimGeocoderAdapter } from './infrastructure/adapters/nominatim-geocoder.adapter';
import { TypeormGeocodeCacheRepository } from './infrastructure/persistence/typeorm-geocode-cache.repository';
import { PlacesController } from './presentation/http/places.controller';

@Module({
  controllers: [PlacesController],
  providers: [
    SearchPlacesUseCase,
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
  ],
  // Caso de uso exportado para o MCP (A4) e o contexto routing.
  exports: [SearchPlacesUseCase],
})
export class GeocodingModule {}
