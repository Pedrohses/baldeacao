import { Injectable } from '@nestjs/common';
import { FindNearbyStopsUseCase } from '../../../transit/application/use-cases/find-nearby-stops.use-case';
import { type Coordinates, Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { GeocodeCache } from '../../domain/ports/geocode-cache.port';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { KnownPlaceRepository } from '../../domain/ports/known-place-repository.port';
import type { ReversePlaceInput, ReversePlaceOutput } from '../dto/reverse-place.dto';
import { GEOCODE_CACHE_TTL_S, GEOCODE_EMPTY_CACHE_TTL_S } from './search-places.use-case';

/** Lugar ou parada local a até isto do ponto dispensa o Nominatim. */
export const REVERSE_LOCAL_RADIUS_M = 60;
/** Casas decimais da coordenada na chave do cache e na consulta (4 casas ~ 11 m). */
export const REVERSE_CACHE_DECIMALS = 4;

function isValid(point: Coordinates): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lon) <= 180
  );
}

/** Chave do cache do reverse: "reverse:-23.5614,-46.6559". */
export function reverseCacheKey(point: Coordinates): string {
  return `reverse:${point.lat.toFixed(REVERSE_CACHE_DECIMALS)},${point.lon.toFixed(REVERSE_CACHE_DECIMALS)}`;
}

/**
 * Lugar mais próximo de um ponto: primeiro lugar conhecido ou parada local a até 60 m (sem
 * rede); senão o reverse do Nominatim (cache antes, pela coordenada arredondada a 4 casas).
 */
@Injectable()
export class ReversePlaceUseCase {
  constructor(
    private readonly cache: GeocodeCache,
    private readonly geocoder: Geocoder,
    private readonly knownPlaces: KnownPlaceRepository,
    private readonly nearbyStops: FindNearbyStopsUseCase,
  ) {}

  async execute(input: ReversePlaceInput): Promise<ReversePlaceOutput> {
    if (!isValid(input.location)) throw new InvalidPlaceQueryError('Coordenada inválida.');

    const local = await this.findLocal(input.location);
    if (local) return { place: local };

    const rounded = {
      lat: Number(input.location.lat.toFixed(REVERSE_CACHE_DECIMALS)),
      lon: Number(input.location.lon.toFixed(REVERSE_CACHE_DECIMALS)),
    };
    const key = reverseCacheKey(rounded);
    const cached = await this.cache.get(key);
    if (cached) return { place: cached[0] ?? null };

    const place = await this.geocoder.reverse(rounded);
    const ttl = place ? GEOCODE_CACHE_TTL_S : GEOCODE_EMPTY_CACHE_TTL_S;
    await this.cache.set(key, `${rounded.lat},${rounded.lon}`, place ? [place] : [], ttl);
    return { place };
  }

  /** O mais próximo entre lugar conhecido e parada, dentro do raio local. */
  private async findLocal(location: Coordinates): Promise<Place | null> {
    const [known, { stops }] = await Promise.all([
      this.knownPlaces.findNearest(location, REVERSE_LOCAL_RADIUS_M),
      this.nearbyStops.execute({ center: location, radiusM: REVERSE_LOCAL_RADIUS_M, limit: 1 }),
    ]);
    const stop = stops[0];
    if (stop && (!known || stop.distanceM <= known.distanceM)) {
      return new Place({
        id: `stop:${stop.stop.id}`,
        name: stop.stop.name,
        address: stop.stop.description,
        kind: 'stop',
        location: stop.stop.location,
      });
    }
    return known?.place ?? null;
  }
}
