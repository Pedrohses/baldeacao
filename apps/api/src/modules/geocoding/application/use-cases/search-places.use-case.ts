import { Injectable } from '@nestjs/common';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { FindAccessStopsUseCase } from '../../../transit/application/use-cases/find-access-stops.use-case';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
import { Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import { type PlaceCandidate, rankPlaces } from '../../domain/value-objects/local-place-rank';
import { COMPACT_ACCESS_RADIUS_M } from '../../domain/value-objects/place-access';
import {
  isPostalCodeQuery,
  normalizePlaceQuery,
  parseIntersectionQuery,
} from '../../domain/value-objects/place-query';
import { distanceM } from '../../domain/value-objects/service-city';
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
/** Trechos pedidos por via ao procurar a esquina (as avenidas longas têm dezenas). */
export const INTERSECTION_STREET_LIMIT = 40;
/** Esquina: as duas vias têm pontos a até isto um do outro. */
export const INTERSECTION_MAX_GAP_M = 300;
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
    private readonly accessStops: FindAccessStopsUseCase,
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
      return { places: await this.withGtfsStations(ranked) };
    }

    const local = await this.localCandidates(key);
    let remote: Place[];
    let corner: Place[] | null = null;
    try {
      remote = await this.searchRemote(key, input.query);
      corner = await this.searchIntersection(key);
    } catch (error) {
      // Com resultado local, a falha do Nominatim não derruba a busca.
      if (error instanceof SourceUnavailableError && local.length > 0) {
        const ranked = rankPlaces(key, await this.withCityFlags(local), SEARCH_PLACES_LIMIT);
        return { places: await this.withGtfsStations(ranked) };
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
    const places = await this.withGtfsStations(ranked);
    // Esquina pedida: a esquina (ou a primeira via) vem antes do resto.
    if (!corner) return { places };
    const ids = new Set(corner.map((p) => p.id));
    const rest = places.filter((p) => !ids.has(p.id));
    return { places: [...corner, ...rest].slice(0, SEARCH_PLACES_LIMIT) };
  }

  /**
   * Estação (do OSM ou do Nominatim) passa a ser a parada GTFS da própria estação a até 400 m:
   * id "stop:<id>" e a coordenada da parada, para a rota começar ou terminar na plataforma e a
   * mesma estação não aparecer duas vezes. Os demais lugares mantêm a coordenada original (o
   * centroide, para o mapa); o acesso de lugar grande é resolvido no planejamento
   * (ResolvePlaceAccessUseCase).
   */
  private async withGtfsStations(places: Place[]): Promise<Place[]> {
    const resolved = await Promise.all(places.map((place) => this.gtfsStation(place)));
    const seen = new Set<string>();
    return resolved.filter((place) => {
      if (seen.has(place.id)) return false;
      seen.add(place.id);
      return true;
    });
  }

  private async gtfsStation(place: Place): Promise<Place> {
    if (place.kind !== 'station' || place.id.startsWith('stop:')) return place;
    const { station } = await this.accessStops.execute({
      center: place.location,
      radiusM: COMPACT_ACCESS_RADIUS_M,
    });
    if (!station) return place;
    return new Place({ ...place, id: `stop:${station.stop.id}`, location: station.stop.location });
  }

  /**
   * "Esquina da X com a Y": busca as duas vias no Nominatim (cache antes de cada uma) e, entre
   * os trechos devolvidos, pega o par mais próximo; a até 300 m, o ponto médio vira a esquina.
   * Sem par perto, devolve os trechos da primeira via. null quando o texto não é esquina.
   */
  private async searchIntersection(key: string): Promise<Place[] | null> {
    const streets = parseIntersectionQuery(key);
    if (!streets) return null;
    const [first, second] = streets;
    const [a, b] = await Promise.all([this.streetPoints(first), this.streetPoints(second)]);
    let best: { a: Place; b: Place; gap: number } | null = null;
    for (const pa of a) {
      for (const pb of b) {
        const gap = distanceM(pa.location, pb.location);
        if (!best || gap < best.gap) best = { a: pa, b: pb, gap };
      }
    }
    if (!best || best.gap > INTERSECTION_MAX_GAP_M) {
      const roads = a.filter((p) => !p.id.startsWith('stop:'));
      return roads.length > 0 ? roads : null;
    }
    return [
      new Place({
        id: `corner:${best.a.id}:${best.b.id}`,
        name: `${best.a.name} com ${best.b.name}`,
        address: best.a.address,
        kind: 'address',
        location: {
          lat: (best.a.location.lat + best.b.location.lat) / 2,
          lon: (best.a.location.lon + best.b.location.lon) / 2,
        },
      }),
    ];
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

  /**
   * Pontos de uma via: trechos do Nominatim e paradas de ônibus com o nome dela ("Av. Ipiranga,
   * 344" vira "Av. Ipiranga"), que costumam ficar perto das esquinas.
   */
  private async streetPoints(street: string): Promise<Place[]> {
    const [roads, { stops, stationIds }] = await Promise.all([
      this.searchStreet(street),
      this.searchStops.execute({ text: street, limit: SEARCH_PLACES_STOPS_POOL }),
    ]);
    const stations = new Set(stationIds);
    const onStreet = stops
      .filter((stop) => !stations.has(stop.id) && /,\s*\d+\s*$/.test(stop.name))
      .map(
        (stop) =>
          new Place({
            id: `stop:${stop.id}`,
            name: stop.name.replace(/,\s*\d+\s*$/, ''),
            address: null,
            kind: 'address',
            location: stop.location,
          }),
      );
    return [...roads, ...onStreet];
  }

  /** Trechos de uma via, com cache próprio ("street:paulista"). */
  private async searchStreet(street: string): Promise<Place[]> {
    const key = `street:${street}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const places = await this.geocoder.searchStreet(street, INTERSECTION_STREET_LIMIT);
    const ttl = places.length > 0 ? GEOCODE_CACHE_TTL_S : GEOCODE_EMPTY_CACHE_TTL_S;
    await this.cache.set(key, street, places, ttl);
    return places;
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
