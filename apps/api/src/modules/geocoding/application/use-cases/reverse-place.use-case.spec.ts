import {
  InMemoryGeocodeCache,
  InMemoryKnownPlaceRepository,
} from '../../../../../test/support/geocoding-in-memory';
import {
  InMemoryStopRepository,
  stopPaulista,
} from '../../../../../test/support/transit-in-memory';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { FindNearbyStopsUseCase } from '../../../transit/application/use-cases/find-nearby-stops.use-case';
import { type Coordinates, Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { GEOCODE_CACHE_TTL_S, GEOCODE_EMPTY_CACHE_TTL_S } from './search-places.use-case';
import { ReversePlaceUseCase, reverseCacheKey } from './reverse-place.use-case';

const ADDRESS = new Place({
  id: 'osm:way:4335741',
  name: 'Avenida Paulista',
  address: 'Avenida Paulista, Bela Vista, São Paulo',
  kind: 'address',
  location: { lat: -23.5633, lon: -46.6544 },
});

const MASP = new Place({
  id: 'osm:way:7',
  name: 'Museu de Arte de São Paulo',
  address: null,
  kind: 'poi',
  location: { lat: -23.5615, lon: -46.6562 },
});

class ReverseGeocoder extends Geocoder {
  readonly calls: Coordinates[] = [];
  constructor(private readonly result: Place | null | Error = ADDRESS) {
    super();
  }
  search(): Promise<Place[]> {
    return Promise.resolve([]);
  }
  reverse(location: Coordinates): Promise<Place | null> {
    this.calls.push(location);
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

function build(geocoder: Geocoder, known: Place[] = [], cache = new InMemoryGeocodeCache()) {
  return new ReversePlaceUseCase(
    cache,
    geocoder,
    new InMemoryKnownPlaceRepository(known.map((place) => ({ place, importance: 5 }))),
    new FindNearbyStopsUseCase(new InMemoryStopRepository()),
  );
}

describe('ReversePlaceUseCase', () => {
  it('parada a até 60 m responde sem Nominatim', async () => {
    const geocoder = new ReverseGeocoder();
    const { place } = await build(geocoder).execute({
      location: { lat: -23.5616, lon: -46.6559 },
    });
    expect(place).toMatchObject({ id: `stop:${stopPaulista.id}`, kind: 'stop' });
    expect(geocoder.calls).toHaveLength(0);
  });

  it('entre lugar conhecido e parada, fica o mais próximo', async () => {
    const { place } = await build(new ReverseGeocoder(), [MASP]).execute({
      location: { lat: -23.5615, lon: -46.6561 },
    });
    expect(place).toEqual(MASP);
  });

  it('sem nada local, chama o reverse com a coordenada arredondada e guarda no cache', async () => {
    const cache = new InMemoryGeocodeCache();
    const geocoder = new ReverseGeocoder();
    const useCase = build(geocoder, [], cache);

    const first = await useCase.execute({ location: { lat: -23.56329, lon: -46.65441 } });
    const second = await useCase.execute({ location: { lat: -23.563312, lon: -46.654412 } });

    expect(first.place).toEqual(ADDRESS);
    expect(second.place).toEqual(ADDRESS);
    expect(geocoder.calls).toEqual([{ lat: -23.5633, lon: -46.6544 }]);
    expect(cache.entries.get('reverse:-23.5633,-46.6544')?.expiresAtMs).toBe(
      GEOCODE_CACHE_TTL_S * 1000,
    );
  });

  it('sem lugar devolve null e guarda o vazio por 1 dia', async () => {
    const cache = new InMemoryGeocodeCache();
    const { place } = await build(new ReverseGeocoder(null), [], cache).execute({
      location: { lat: -10, lon: -40 },
    });
    expect(place).toBeNull();
    expect(cache.entries.get(reverseCacheKey({ lat: -10, lon: -40 }))).toMatchObject({
      places: [],
      expiresAtMs: GEOCODE_EMPTY_CACHE_TTL_S * 1000,
    });
  });

  it('recusa coordenada inválida e propaga a falha do Nominatim', async () => {
    await expect(
      build(new ReverseGeocoder()).execute({ location: { lat: 95, lon: 0 } }),
    ).rejects.toBeInstanceOf(InvalidPlaceQueryError);
    await expect(
      build(new ReverseGeocoder(new SourceUnavailableError('nominatim'))).execute({
        location: { lat: -10, lon: -40 },
      }),
    ).rejects.toBeInstanceOf(SourceUnavailableError);
  });
});
