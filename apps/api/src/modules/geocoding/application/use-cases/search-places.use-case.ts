import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { FindNearbyStopsUseCase } from '../../../transit/application/use-cases/find-nearby-stops.use-case';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
import { Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import { type PlaceCandidate, rankPlaces } from '../../domain/value-objects/local-place-rank';
import {
  ACCESS_POINT_MIN_OFFSET_M,
  ACCESS_POINT_RADIUS_M,
  LARGE_PLACE_CATEGORIES,
} from '../../domain/value-objects/osm-poi-category';
import { isPostalCodeQuery, normalizePlaceQuery } from '../../domain/value-objects/place-query';
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
    private readonly nearbyStops: FindNearbyStopsUseCase,
  ) {}

  async execute(input: SearchPlacesInput): Promise<SearchPlacesOutput> {
    const key = normalizePlaceQuery(input.query);
    if (key.length < SEARCH_PLACES_QUICK_MIN_LENGTH) {
      throw new InvalidPlaceQueryError(
        `Digite pelo menos ${SEARCH_PLACES_QUICK_MIN_LENGTH} caracteres para buscar um lugar.`,
      );
    }

    // Só CEP: nada local casa com dígitos; no full vai direto ao Nominatim (busca estruturada).
    if (isPostalCodeQuery(key)) {
      if (input.mode === 'quick') return { places: [] };
      // Chave própria ("cep:01310-200"): não reaproveita o cache da busca por texto livre.
      const digits = key.replace(/\D/g, '');
      const cepKey = `cep:${digits.slice(0, 5)}-${digits.slice(5)}`;
      const remote = await this.searchRemote(cepKey, input.query);
      // O OSM tem CEP com ponto errado (ex.: 01310-200 em Nazaré Paulista): fora do município,
      // melhor nada do que um lugar errado.
      const inCity = await this.knownPlaces.inServiceCity(remote.map((p) => p.location));
      const places = remote.filter((_, i) => inCity[i] !== false);
      return { places: places.slice(0, SEARCH_PLACES_LIMIT) };
    }

    if (input.mode === 'quick' || key.length < SEARCH_PLACES_MIN_LENGTH) {
      const local = await this.localCandidates(key);
      const ranked = rankPlaces(key, await this.withCityFlags(local), SEARCH_PLACES_LIMIT);
      return { places: await this.withAccessPoints(ranked, local) };
    }

    const local = await this.localCandidates(key);
    let remote: Place[];
    try {
      remote = await this.searchRemote(key, input.query);
    } catch (error) {
      // Com resultado local, a falha do Nominatim não derruba a busca.
      if (error instanceof SourceUnavailableError && local.length > 0) {
        const ranked = rankPlaces(key, await this.withCityFlags(local), SEARCH_PLACES_LIMIT);
        return { places: await this.withAccessPoints(ranked, local) };
      }
      throw error;
    }
    const remoteCandidates: PlaceCandidate[] = remote.map((place, index) => ({
      place,
      aliases: [],
      importance: REMOTE_IMPORTANCE[place.kind],
      inCity: null,
      remoteIndex: index,
      category: null,
    }));
    const candidates = await this.withCityFlags([...local, ...remoteCandidates]);
    const ranked = rankPlaces(key, candidates, SEARCH_PLACES_LIMIT);
    return { places: await this.withAccessPoints(ranked, candidates) };
  }

  /**
   * Lugar grande (aeroporto, parque, campus...; ver LARGE_PLACE_CATEGORIES) troca o centroide
   * pela parada ou estação mais próxima dele a até 1,5 km, quando o centroide está a mais de
   * 250 m de qualquer parada: é por ali que se chega, e a rota não termina no meio do pátio.
   * Nome, id e endereço continuam os do lugar.
   */
  private async withAccessPoints(places: Place[], candidates: PlaceCandidate[]): Promise<Place[]> {
    // O mesmo id pode vir do banco (com categoria) e do Nominatim (sem): vale a do banco.
    const categories = new Map<string, string>();
    for (const c of candidates) if (c.category) categories.set(c.place.id, c.category);
    return Promise.all(
      places.map(async (place) => {
        const category = categories.get(place.id);
        if (!category || !LARGE_PLACE_CATEGORIES.has(category)) return place;
        const { stops } = await this.nearbyStops.execute({
          center: place.location,
          radiusM: ACCESS_POINT_RADIUS_M,
          limit: 1,
        });
        const nearest = stops[0];
        if (!nearest || nearest.distanceM <= ACCESS_POINT_MIN_OFFSET_M) return place;
        return new Place({ ...place, location: nearest.stop.location });
      }),
    );
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
          category: null,
        };
      }),
      ...known.map((match): PlaceCandidate => ({
        place: match.place,
        aliases: match.aliases,
        importance: match.importance,
        inCity: match.inCity,
        remoteIndex: null,
        category: match.category,
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
