import {
  InMemoryGeocodeCache,
  InMemoryKnownPlaceRepository,
  fakeNominatimFetch,
  readNominatimFixture,
} from '../../../../../test/support/geocoding-in-memory';
import { SourceUnavailableError } from '../../../../shared/domain/errors/source-unavailable.error';
import {
  InMemoryStopRepository,
  stopLiberdade,
  stopPaulista,
} from '../../../../../test/support/transit-in-memory';
import { SearchStopsByNameUseCase } from '../../../transit/application/use-cases/search-stops-by-name.use-case';
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

function noStops(): SearchStopsByNameUseCase {
  return new SearchStopsByNameUseCase(new InMemoryStopRepository([]));
}

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
  reverse(): Promise<Place | null> {
    return Promise.resolve(null);
  }
}

describe('SearchPlacesUseCase', () => {
  it('segunda busca igual (mesmo com caixa e espaços diferentes) não chama o geocoder', async () => {
    const cache = new InMemoryGeocodeCache();
    const geocoder = new FakeGeocoder();
    const useCase = new SearchPlacesUseCase(
      cache,
      geocoder,
      noStops(),
      new InMemoryKnownPlaceRepository(),
    );

    const first = await useCase.execute({ query: '  Praça da  Sé ', mode: 'full' });
    const second = await useCase.execute({ query: 'praça da sé', mode: 'full' });

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
      noStops(),
      new InMemoryKnownPlaceRepository(),
    );
    const first = await useCase.execute({ query: 'Estádio do Morumbis', mode: 'full' });
    const second = await useCase.execute({ query: 'estádio do morumbis', mode: 'full' });
    expect(fetchFn.calls).toHaveLength(1);
    expect(second.places).toEqual(first.places);
    expect(first.places).toHaveLength(4);
  });

  it('cache longo (30 dias) com resultado e curto (1 dia) sem resultado; expirado busca de novo', async () => {
    const cache = new InMemoryGeocodeCache();
    const geocoder = new FakeGeocoder([]);
    const useCase = new SearchPlacesUseCase(
      cache,
      geocoder,
      noStops(),
      new InMemoryKnownPlaceRepository(),
    );

    await useCase.execute({ query: 'lugar que não existe', mode: 'full' });
    expect(cache.entries.get('lugar que não existe')?.expiresAtMs).toBe(
      GEOCODE_EMPTY_CACHE_TTL_S * 1000,
    );
    cache.nowMs = GEOCODE_EMPTY_CACHE_TTL_S * 1000;
    await useCase.execute({ query: 'lugar que não existe', mode: 'full' });
    expect(geocoder.calls).toHaveLength(2);

    const withResult = new InMemoryGeocodeCache();
    await new SearchPlacesUseCase(
      withResult,
      new FakeGeocoder(),
      noStops(),
      new InMemoryKnownPlaceRepository(),
    ).execute({
      query: 'sé sé',
      mode: 'full',
    });
    expect(withResult.entries.get('sé sé')?.expiresAtMs).toBe(GEOCODE_CACHE_TTL_S * 1000);
  });

  it('texto com menos de 2 caracteres é recusado sem consultar nada', async () => {
    const geocoder = new FakeGeocoder();
    const useCase = new SearchPlacesUseCase(
      new InMemoryGeocodeCache(),
      geocoder,
      noStops(),
      new InMemoryKnownPlaceRepository(),
    );
    await expect(useCase.execute({ query: '  s  ', mode: 'full' })).rejects.toBeInstanceOf(
      InvalidPlaceQueryError,
    );
    expect(geocoder.calls).toHaveLength(0);
  });

  it('falha da fonte não grava no cache', async () => {
    const cache = new InMemoryGeocodeCache();
    const useCase = new SearchPlacesUseCase(
      cache,
      new FakeGeocoder(new SourceUnavailableError('nominatim')),
      noStops(),
      new InMemoryKnownPlaceRepository(),
    );
    await expect(useCase.execute({ query: 'paulista', mode: 'full' })).rejects.toBeInstanceOf(
      SourceUnavailableError,
    );
    expect(cache.entries.size).toBe(0);
  });

  describe('modo quick e full com paradas locais', () => {
    const stops = () => new SearchStopsByNameUseCase(new InMemoryStopRepository());

    it('quick devolve só paradas locais (id stop:<id>, sem acento) e não chama Nominatim nem cache', async () => {
      const cache = new InMemoryGeocodeCache();
      const geocoder = new FakeGeocoder();
      const useCase = new SearchPlacesUseCase(
        cache,
        geocoder,
        stops(),
        new InMemoryKnownPlaceRepository(),
      );

      const { places } = await useCase.execute({ query: 'PAULISTA', mode: 'quick' });

      expect(places).toEqual([
        new Place({
          id: 'stop:4301848',
          name: 'Av. Paulista 1578',
          address: 'Em frente ao MASP',
          kind: 'stop',
          location: stopPaulista.location,
        }),
      ]);
      expect(geocoder.calls).toHaveLength(0);
      expect(cache.entries.size).toBe(0);
    });

    it('quick junta paradas e lugares conhecidos do OSM, estação antes e lugar antes de parada comum', async () => {
      const botanico = new Place({
        id: 'osm:relation:5349780',
        name: 'Jardim Botânico de São Paulo',
        address: 'Avenida Miguel Estéfano, 3031, Água Funda, São Paulo',
        kind: 'poi',
        location: { lat: -23.6418, lon: -46.6253 },
      });
      const repository = new InMemoryStopRepository();
      repository.stationIds.add(stopLiberdade.id);
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder(),
        new SearchStopsByNameUseCase(repository),
        new InMemoryKnownPlaceRepository([
          { place: botanico, importance: 8 },
          {
            place: new Place({
              ...botanico,
              id: 'osm:way:1',
              name: 'Av. Liberdade (praça)',
              location: { lat: -23.5, lon: -46.5 },
            }),
            importance: 3,
          },
        ]),
      );
      const jardim = await useCase.execute({ query: 'jardim bot', mode: 'quick' });
      expect(jardim.places).toEqual([botanico]);
      const av = await useCase.execute({ query: 'av', mode: 'quick' });
      expect(av.places.map((p) => p.id)).toEqual([
        `stop:${stopLiberdade.id}`,
        'osm:way:1',
        `stop:${stopPaulista.id}`,
      ]);
    });

    it('quick aceita 2 caracteres', async () => {
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder(),
        stops(),
        new InMemoryKnownPlaceRepository(),
      );
      const { places } = await useCase.execute({ query: 'ib', mode: 'quick' });
      expect(places.map((p) => p.id)).toEqual([`stop:${stopLiberdade.id}`]);
    });

    it('full junta locais primeiro e Nominatim, sem duplicar o mesmo lugar', async () => {
      const duplicate = new Place({
        id: 'osm:node:9',
        name: 'Av. Paulista',
        address: 'Bela Vista, São Paulo',
        kind: 'address',
        location: { lat: -23.5615, lon: -46.656 },
      });
      const far = new Place({
        id: 'osm:node:10',
        name: 'Av. Paulista',
        address: 'Outra cidade',
        kind: 'address',
        location: { lat: -22.9, lon: -47.0 },
      });
      const geocoder = new FakeGeocoder([SE, duplicate, far]);
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        geocoder,
        stops(),
        new InMemoryKnownPlaceRepository(),
      );

      const { places } = await useCase.execute({ query: 'paulista', mode: 'full' });

      expect(places.map((p) => p.id)).toEqual(['stop:4301848', 'osm:node:1', 'osm:node:10']);
      expect(geocoder.calls).toHaveLength(1);
    });

    it('full com Nominatim fora do ar mantém as paradas locais', async () => {
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder(new SourceUnavailableError('nominatim')),
        stops(),
        new InMemoryKnownPlaceRepository(),
      );
      const { places } = await useCase.execute({ query: 'paulista', mode: 'full' });
      expect(places.map((p) => p.id)).toEqual(['stop:4301848']);
    });
  });
});
