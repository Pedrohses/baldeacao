import {
  InMemoryGeocodeCache,
  fakeNominatimFetch,
  readNominatimFixture,
} from '../../../../../test/support/geocoding-in-memory';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import { Place } from '../../domain/entities/place.entity';
import { InvalidPlaceQueryError } from '../../domain/errors/invalid-place-query.error';
import { Geocoder } from '../../domain/ports/geocoder.port';
import { NominatimClient } from '../../infrastructure/adapters/nominatim.client';
import { NominatimGeocoderAdapter } from '../../infrastructure/adapters/nominatim-geocoder.adapter';
import {
  GEOCODE_CACHE_TTL_S,
  GEOCODE_EMPTY_CACHE_TTL_S,
  SEARCH_PLACES_LIMIT,
  SearchPlacesUseCase,
} from './search-places.use-case';

const SE = new Place({
  id: 'osm:node:1',
  name: 'Praça da Sé',
  address: 'Praça da Sé, Sé, São Paulo',
  kind: 'address',
  location: { lat: -23.5503, lon: -46.6339 },
});

class FakeGeocoder extends Geocoder {
  readonly calls: Array<{ query: string; limit: number }> = [];
  constructor(private readonly result: Place[] | Error = [SE]) {
    super();
  }
  search(query: string, limit: number): Promise<Place[]> {
    this.calls.push({ query, limit });
    return this.result instanceof Error
      ? Promise.reject(this.result)
      : Promise.resolve(this.result);
  }
}

describe('SearchPlacesUseCase', () => {
  it('segunda busca igual (mesmo com caixa e espaços diferentes) não chama o geocoder', async () => {
    const cache = new InMemoryGeocodeCache();
    const geocoder = new FakeGeocoder();
    const useCase = new SearchPlacesUseCase(cache, geocoder);

    const first = await useCase.execute({ query: '  Praça da  Sé ' });
    const second = await useCase.execute({ query: 'praça da sé' });

    expect(first.places).toEqual([SE]);
    expect(second.places).toEqual([SE]);
    expect(geocoder.calls).toEqual([{ query: 'praça da sé', limit: SEARCH_PLACES_LIMIT }]);
    expect(cache.entries.get('praça da sé')?.query).toBe('Praça da  Sé');
  });

  it('com o Nominatim (fetch falso) a segunda busca igual não faz requisição', async () => {
    const fetchFn = fakeNominatimFetch(readNominatimFixture('search-morumbis.json'));
    const useCase = new SearchPlacesUseCase(
      new InMemoryGeocodeCache(),
      new NominatimGeocoderAdapter(
        new NominatimClient({
          baseUrl: 'https://nominatim.test',
          userAgent: 'test',
          fetch: fetchFn,
        }),
      ),
    );
    const first = await useCase.execute({ query: 'Estádio do Morumbis' });
    const second = await useCase.execute({ query: 'estádio do morumbis' });
    expect(fetchFn.calls).toHaveLength(1);
    expect(second.places).toEqual(first.places);
    expect(first.places).toHaveLength(4);
  });

  it('cache longo (30 dias) com resultado e curto (1 dia) sem resultado; expirado busca de novo', async () => {
    const cache = new InMemoryGeocodeCache();
    const geocoder = new FakeGeocoder([]);
    const useCase = new SearchPlacesUseCase(cache, geocoder);

    await useCase.execute({ query: 'lugar que não existe' });
    expect(cache.entries.get('lugar que não existe')?.expiresAtMs).toBe(
      GEOCODE_EMPTY_CACHE_TTL_S * 1000,
    );
    cache.nowMs = GEOCODE_EMPTY_CACHE_TTL_S * 1000;
    await useCase.execute({ query: 'lugar que não existe' });
    expect(geocoder.calls).toHaveLength(2);

    const withResult = new InMemoryGeocodeCache();
    await new SearchPlacesUseCase(withResult, new FakeGeocoder()).execute({ query: 'sé sé' });
    expect(withResult.entries.get('sé sé')?.expiresAtMs).toBe(GEOCODE_CACHE_TTL_S * 1000);
  });

  it('texto com menos de 3 caracteres é recusado sem consultar nada', async () => {
    const geocoder = new FakeGeocoder();
    const useCase = new SearchPlacesUseCase(new InMemoryGeocodeCache(), geocoder);
    await expect(useCase.execute({ query: '  s  ' })).rejects.toBeInstanceOf(
      InvalidPlaceQueryError,
    );
    expect(geocoder.calls).toHaveLength(0);
  });

  it('falha da fonte não grava no cache', async () => {
    const cache = new InMemoryGeocodeCache();
    const useCase = new SearchPlacesUseCase(
      cache,
      new FakeGeocoder(new SourceUnavailableError('nominatim')),
    );
    await expect(useCase.execute({ query: 'paulista' })).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
    expect(cache.entries.size).toBe(0);
  });
});
