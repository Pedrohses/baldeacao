import { Injectable } from '@nestjs/common';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { normalizePlaceQuery } from '../../domain/value-objects/place-query';
import type { SearchPlacesInput, SearchPlacesOutput } from '../dto/search-places.dto';

export const SEARCH_PLACES_MIN_LENGTH = 3;
export const SEARCH_PLACES_LIMIT = 8;
/** Endereços mudam pouco: 30 dias. */
export const GEOCODE_CACHE_TTL_S = 30 * 24 * 60 * 60;
/** Busca sem resultado expira antes (1 dia), para um lugar novo no OSM aparecer logo. */
export const GEOCODE_EMPTY_CACHE_TTL_S = 24 * 60 * 60;

/** Busca de lugar por texto: sempre o cache antes; sem cache, a fonte externa (Nominatim). */
@Injectable()
export class SearchPlacesUseCase {
  constructor(
    private readonly cache: GeocodeCache,
    private readonly geocoder: Geocoder,
  ) {}

  async execute(input: SearchPlacesInput): Promise<SearchPlacesOutput> {
    const key = normalizePlaceQuery(input.query);
    if (key.length < SEARCH_PLACES_MIN_LENGTH) {
      throw new InvalidPlaceQueryError(
        `Digite pelo menos ${SEARCH_PLACES_MIN_LENGTH} caracteres para buscar um lugar.`,
      );
    }

    const cached = await this.cache.get(key);
    if (cached) return { places: cached };

    const places = await this.geocoder.search(key, SEARCH_PLACES_LIMIT);
    const ttl = places.length > 0 ? GEOCODE_CACHE_TTL_S : GEOCODE_EMPTY_CACHE_TTL_S;
    await this.cache.set(key, input.query.trim(), places, ttl);
    return { places };
  }
}
