import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
import { Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import { type PlaceCandidate, rankPlaces } from '../../domain/value-objects/local-place-rank';
import { normalizePlaceQuery } from '../../domain/value-objects/place-query';
import type { SearchPlacesInput, SearchPlacesOutput } from '../dto/search-places.dto';

/** Mínimo para a busca local (autocompletar). */
export const SEARCH_PLACES_QUICK_MIN_LENGTH = 2;
/** Mínimo para consultar o Nominatim (modo full). */
export const SEARCH_PLACES_MIN_LENGTH = 3;
export const SEARCH_PLACES_LIMIT = 8;
/** Candidatos locais pedidos ao banco antes de ordenar (paradas e lugares conhecidos). */
export const SEARCH_PLACES_STOPS_POOL = 20;
export const SEARCH_PLACES_KNOWN_POOL = 40;
/** Importância de uma estação de metrô/trem (igual a railway=station em osm-poi-category). */
export const STATION_IMPORTANCE = 8;
/** Endereços mudam pouco: 30 dias. */
export const GEOCODE_CACHE_TTL_S = 30 * 24 * 60 * 60;
/** Busca sem resultado expira antes (1 dia), para um lugar novo no OSM aparecer logo. */
export const GEOCODE_EMPTY_CACHE_TTL_S = 24 * 60 * 60;

/**
 * Busca de lugar por texto. `quick`: só o banco local (paradas, estações e lugares conhecidos
 * do OSM), sem rede, para autocompletar. `full`: o local e o Nominatim (cache antes) ordenados
 * juntos pela qualidade do match (rankPlaces), sem repetir o lugar.
 */
// Importância dos resultados do Nominatim por tipo (sem categoria, só o tipo do lugar).
const REMOTE_IMPORTANCE: Record<Place['kind'], number> = {
  poi: 4,
  station: STATION_IMPORTANCE,
  stop: 0,
  address: 2,
  coordinates: 0,
};

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

    if (input.mode === 'quick' || key.length < SEARCH_PLACES_MIN_LENGTH) {
      const local = await this.localCandidates(key);
      return { places: rankPlaces(key, await this.withCityFlags(local), SEARCH_PLACES_LIMIT) };
    }

    const local = await this.localCandidates(key);
    let remote: Place[];
    try {
      remote = await this.searchRemote(key, input.query);
    } catch (error) {
      // Com resultado local, a falha do Nominatim não derruba a busca.
      if (error instanceof SourceUnavailableError && local.length > 0) {
        return { places: rankPlaces(key, await this.withCityFlags(local), SEARCH_PLACES_LIMIT) };
      }
      throw error;
    }
    const remoteCandidates: PlaceCandidate[] = remote.map((place, index) => ({
      place,
      aliases: [],
      importance: REMOTE_IMPORTANCE[place.kind],
      inCity: null,
      remoteIndex: index,
    }));
    const candidates = await this.withCityFlags([...local, ...remoteCandidates]);
    return { places: rankPlaces(key, candidates, SEARCH_PLACES_LIMIT) };
  }

  /** Paradas, estações e lugares conhecidos que casam com o texto (sem ordem final). */
  private async localCandidates(key: string): Promise<PlaceCandidate[]> {
    const [{ stops, stationIds }, known] = await Promise.all([
      this.searchStops.execute({ text: key, limit: SEARCH_PLACES_STOPS_POOL }),
      this.knownPlaces.searchByName(key, SEARCH_PLACES_KNOWN_POOL),
    ]);
    const stations = new Set(stationIds);
    return [
      ...stops.map((stop): PlaceCandidate => {
        const isStation = stations.has(stop.id);
        return {
          place: new Place({
            id: `stop:${stop.id}`,
            name: stop.name,
            address: stop.description,
            kind: isStation ? 'station' : 'stop',
            location: stop.location,
          }),
          aliases: [],
          importance: isStation ? STATION_IMPORTANCE : 0,
          inCity: null,
          remoteIndex: null,
        };
      }),
      ...known.map((match): PlaceCandidate => ({
        place: match.place,
        aliases: match.aliases,
        importance: match.importance,
        inCity: match.inCity,
        remoteIndex: null,
      })),
    ];
  }

  /** Preenche `inCity` de quem ainda não sabe (paradas e Nominatim) numa consulta só. */
  private async withCityFlags(candidates: PlaceCandidate[]): Promise<PlaceCandidate[]> {
    const unknown = candidates.filter((c) => c.inCity === null);
    if (unknown.length === 0) return candidates;
    const flags = await this.knownPlaces.inServiceCity(unknown.map((c) => c.place.location));
    const byCandidate = new Map(unknown.map((c, i) => [c, flags[i] ?? null]));
    return candidates.map((c) =>
      byCandidate.has(c) ? { ...c, inCity: byCandidate.get(c) ?? null } : c,
    );
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
