import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
import { Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import {
  type LocalPlaceCandidate,
  rankLocalPlaces,
} from '../../domain/value-objects/local-place-rank';
import { mergePlaces } from '../../domain/value-objects/place-merge';
import { normalizePlaceQuery } from '../../domain/value-objects/place-query';
import type { SearchPlacesInput, SearchPlacesOutput } from '../dto/search-places.dto';

/** Mínimo para a busca local (autocompletar). */
export const SEARCH_PLACES_QUICK_MIN_LENGTH = 2;
/** Mínimo para consultar o Nominatim (modo full). */
export const SEARCH_PLACES_MIN_LENGTH = 3;
export const SEARCH_PLACES_LIMIT = 8;
/** No modo full, no máximo isto vem das paradas locais, para sobrar espaço ao Nominatim. */
export const SEARCH_PLACES_FULL_LOCAL_LIMIT = 4;
/** Endereços mudam pouco: 30 dias. */
export const GEOCODE_CACHE_TTL_S = 30 * 24 * 60 * 60;
/** Busca sem resultado expira antes (1 dia), para um lugar novo no OSM aparecer logo. */
export const GEOCODE_EMPTY_CACHE_TTL_S = 24 * 60 * 60;

/**
 * Busca de lugar por texto. `quick`: só o banco local (paradas, estações e lugares conhecidos
 * do OSM), sem rede, para autocompletar. `full`: o local primeiro e depois o Nominatim (cache
 * antes), sem repetir o lugar.
 */
@Injectable()
export class SearchPlacesUseCase {
  constructor(
    private readonly cache: GeocodeCache,
    private readonly geocoder: Geocoder,
    private readonly searchStops: SearchStopsByNameUseCase,
    private readonly knownPlaces: KnownPlaceRepository,
  ) {}

  async execute(input: SearchPlacesInput): Promise<SearchPlacesOutput> {
    const key = normalizePlaceQuery(input.query);
    if (key.length < SEARCH_PLACES_QUICK_MIN_LENGTH) {
      throw new InvalidPlaceQueryError(
        `Digite pelo menos ${SEARCH_PLACES_QUICK_MIN_LENGTH} caracteres para buscar um lugar.`,
      );
    }

    if (input.mode === 'quick') {
      return { places: await this.searchLocal(key, SEARCH_PLACES_LIMIT) };
    }

    if (key.length < SEARCH_PLACES_MIN_LENGTH) {
      return { places: await this.searchLocal(key, SEARCH_PLACES_LIMIT) };
    }

    const local = await this.searchLocal(key, SEARCH_PLACES_FULL_LOCAL_LIMIT);
    let remote: Place[];
    try {
      remote = await this.searchRemote(key, input.query);
    } catch (error) {
      // Com paradas locais, a falha do Nominatim não derruba a busca.
      if (error instanceof SourceUnavailableError && local.length > 0) return { places: local };
      throw error;
    }
    return { places: mergePlaces(local, remote, SEARCH_PLACES_LIMIT) };
  }

  /** Paradas e lugares conhecidos juntos, ordenados por rankLocalPlaces. */
  private async searchLocal(key: string, limit: number): Promise<Place[]> {
    // Pede a mais dos dois lados: a ordem final só sai depois de juntar e tirar repetidos.
    const [{ stops, stationIds }, known] = await Promise.all([
      this.searchStops.execute({ text: key, limit: SEARCH_PLACES_LIMIT }),
      this.knownPlaces.searchByName(key, SEARCH_PLACES_LIMIT * 2),
    ]);
    const stations = new Set(stationIds);
    const candidates: LocalPlaceCandidate[] = [
      ...stops.map((stop) => ({
        place: new Place({
          id: `stop:${stop.id}`,
          name: stop.name,
          address: stop.description,
          kind: 'stop',
          location: stop.location,
        }),
        isStation: stations.has(stop.id),
        importance: 0,
      })),
      ...known.map((match) => ({ ...match, isStation: false })),
    ];
    return rankLocalPlaces(key, candidates, limit);
  }

  private async searchRemote(key: string, rawQuery: string): Promise<Place[]> {
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const places = await this.geocoder.search(key, SEARCH_PLACES_LIMIT);
    const ttl = places.length > 0 ? GEOCODE_CACHE_TTL_S : GEOCODE_EMPTY_CACHE_TTL_S;
    await this.cache.set(key, rawQuery.trim(), places, ttl);
    return places;
  }
}
