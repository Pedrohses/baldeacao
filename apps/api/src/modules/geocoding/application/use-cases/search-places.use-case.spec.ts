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
import { Stop } from '../../../transit/domain/entities/stop.entity';
import { FindAccessStopsUseCase } from '../../../transit/application/use-cases/find-access-stops.use-case';
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

function nearby(stops?: Stop[]): FindAccessStopsUseCase {
  return new FindAccessStopsUseCase(new InMemoryStopRepository(stops));
}

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
      nearby(),
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
      nearby(),
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
      nearby(),
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
      nearby(),
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
      nearby(),
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
      nearby(),
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
        nearby(),
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
        nearby(),
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
        nearby(),
      );
      const { places } = await useCase.execute({ query: 'ib', mode: 'quick' });
      expect(places.map((p) => p.id)).toEqual([`stop:${stopLiberdade.id}`]);
    });

    it('full ordena locais e Nominatim juntos pela qualidade, sem duplicar o mesmo lugar', async () => {
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
        nearby(),
      );

      const { places } = await useCase.execute({ query: 'paulista', mode: 'full' });

      // "Av. Paulista" (endereço) e a parada "Av. Paulista 1578" a menos de 200 m são o mesmo
      // lugar; o endereço casa o nome inteiro e fica. Praça da Sé não casa "paulista".
      expect(places.map((p) => p.id)).toEqual(['osm:node:9', 'osm:node:10', 'osm:node:1']);
      expect(geocoder.calls).toHaveLength(1);
    });

    it('full com Nominatim fora do ar mantém as paradas locais', async () => {
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder(new SourceUnavailableError('nominatim')),
        stops(),
        new InMemoryKnownPlaceRepository(),
        nearby(),
      );
      const { places } = await useCase.execute({ query: 'paulista', mode: 'full' });
      expect(places.map((p) => p.id)).toEqual(['stop:4301848']);
    });
  });

  it('só CEP: quick vazio; full vai ao Nominatim com chave própria e vazio fica vazio', async () => {
    const cache = new InMemoryGeocodeCache();
    const geocoder = new FakeGeocoder([]);
    const useCase = new SearchPlacesUseCase(
      cache,
      geocoder,
      new SearchStopsByNameUseCase(new InMemoryStopRepository()),
      new InMemoryKnownPlaceRepository(),
      nearby(),
    );
    expect((await useCase.execute({ query: '01310-200', mode: 'quick' })).places).toEqual([]);
    expect(geocoder.calls).toHaveLength(0);
    expect((await useCase.execute({ query: '01310200', mode: 'full' })).places).toEqual([]);
    expect(geocoder.calls).toEqual([{ query: 'cep:01310-200', limit: SEARCH_PLACES_LIMIT }]);
    expect(cache.entries.has('cep:01310-200')).toBe(true);
  });

  it('só CEP: resultado do Nominatim fora do município fica de fora', async () => {
    const nazare = new Place({
      id: 'osm:node:11',
      name: '01310-200',
      address: 'Nazaré Paulista',
      kind: 'address',
      location: { lat: -23.241, lon: -46.4176 },
    });
    const paulista = new Place({ ...nazare, id: 'osm:way:10', location: SE.location });
    const useCase = new SearchPlacesUseCase(
      new InMemoryGeocodeCache(),
      new FakeGeocoder([nazare, paulista]),
      noStops(),
      new InMemoryKnownPlaceRepository([], (p) => p.lat < -23.35),
      nearby(),
    );
    const { places } = await useCase.execute({ query: '01310-200', mode: 'full' });
    expect(places.map((p) => p.id)).toEqual(['osm:way:10']);
  });

  describe('ranking com município e apelidos', () => {
    // "Município" de teste: tudo ao norte de -23.8 e a leste de -46.85.
    const inCity = (p: { lat: number; lon: number }) => p.lat > -23.8 && p.lon > -46.85;

    it('estação vira kind station; parada de ônibus fica stop', async () => {
      const repository = new InMemoryStopRepository();
      repository.stationIds.add(stopLiberdade.id);
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder(),
        new SearchStopsByNameUseCase(repository),
        new InMemoryKnownPlaceRepository(),
        nearby(),
      );
      const { places } = await useCase.execute({ query: 'av', mode: 'quick' });
      expect(places.map((p) => [p.id, p.kind])).toEqual([
        [`stop:${stopLiberdade.id}`, 'station'],
        [`stop:${stopPaulista.id}`, 'stop'],
      ]);
    });

    it('quick acha pelo apelido e joga para baixo o homônimo de outra cidade', async () => {
      const mercadao = new Place({
        id: 'osm:relation:4602996',
        name: 'Mercado Municipal de São Paulo',
        address: null,
        kind: 'poi',
        location: { lat: -23.5417, lon: -46.6297 },
      });
      const jundiai = new Place({
        id: 'osm:way:398442647',
        name: 'Mercadão Vila Arens',
        address: null,
        kind: 'poi',
        location: { lat: -23.19, lon: -46.89 },
      });
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder(),
        noStops(),
        new InMemoryKnownPlaceRepository(
          [
            { place: jundiai, importance: 5 },
            { place: mercadao, importance: 7, aliases: ['Mercado Municipal', 'Mercadão'] },
          ],
          inCity,
        ),
        nearby(),
      );
      const { places } = await useCase.execute({ query: 'Mercadão', mode: 'quick' });
      expect(places.map((p) => p.id)).toEqual([mercadao.id, jundiai.id]);
    });

    it('full: endereço do Nominatim com o mesmo número acima da parada de outro número', async () => {
      const vergueiro = new Place({
        id: 'osm:node:3185',
        name: 'Rua Vergueiro, 3185',
        address: 'Rua Vergueiro, 3185, Vila Mariana, São Paulo',
        kind: 'address',
        location: { lat: -23.588, lon: -46.634 },
      });
      const stop356 = new Stop({
        ...stopPaulista,
        id: '1000',
        name: 'R. Vergueiro, 356',
        location: { lat: -23.567, lon: -46.64 },
      });
      const useCase = new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new FakeGeocoder([vergueiro]),
        new SearchStopsByNameUseCase(new InMemoryStopRepository([stop356])),
        new InMemoryKnownPlaceRepository([], inCity),
        nearby(),
      );
      const { places } = await useCase.execute({ query: 'R. Vergueiro, 3185', mode: 'full' });
      expect(places[0]?.id).toBe(vergueiro.id);
    });
  });

  it('lugar grande mantém o centroide (o acesso fica para o planejamento)', async () => {
    const congonhas = new Place({
      id: 'osm:way:7',
      name: 'Aeroporto de Congonhas',
      address: null,
      kind: 'poi',
      location: { lat: -23.6273, lon: -46.6566 },
    });
    const terminal = new Stop({
      ...stopPaulista,
      id: '2000',
      name: 'Aeroporto de Congonhas',
      location: { lat: -23.6265, lon: -46.6614 },
    });
    const useCase = new SearchPlacesUseCase(
      new InMemoryGeocodeCache(),
      new FakeGeocoder(),
      noStops(),
      new InMemoryKnownPlaceRepository([
        { place: congonhas, importance: 11, category: 'aeroway=aerodrome' },
      ]),
      nearby([terminal]),
    );
    const { places } = await useCase.execute({ query: 'aeroporto', mode: 'quick' });
    expect(places).toEqual([congonhas]);
  });

  it('estação do OSM vira a parada GTFS da estação (id e coordenada) sem repetir', async () => {
    const osmStation = new Place({
      id: 'osm:relation:18483436',
      name: 'Aeroporto Guarulhos',
      address: null,
      kind: 'station',
      location: { lat: -23.43291, lon: -46.49376 },
    });
    const gtfsStation = new Stop({
      ...stopPaulista,
      id: '1814713',
      name: 'Aeroporto Guarulhos',
      description: null,
      location: { lat: -23.433667, lon: -46.493732 },
    });
    const stops = new InMemoryStopRepository([gtfsStation]);
    stops.stationIds.add('1814713');
    const useCase = new SearchPlacesUseCase(
      new InMemoryGeocodeCache(),
      new FakeGeocoder(),
      new SearchStopsByNameUseCase(stops),
      new InMemoryKnownPlaceRepository([
        { place: osmStation, importance: 10, category: 'railway=station' },
      ]),
      new FindAccessStopsUseCase(stops),
    );
    const { places } = await useCase.execute({ query: 'aeroporto guarulhos', mode: 'quick' });
    expect(places.filter((p) => p.kind === 'station')).toHaveLength(1);
    expect(places[0]).toMatchObject({
      id: 'stop:1814713',
      kind: 'station',
      location: gtfsStation.location,
    });
  });

  describe('esquina', () => {
    class StreetGeocoder extends Geocoder {
      constructor(private readonly streets: Record<string, Place[]>) {
        super();
      }
      search(): Promise<Place[]> {
        return Promise.resolve([]);
      }
      override searchStreet(street: string): Promise<Place[]> {
        return Promise.resolve(this.streets[street] ?? []);
      }
      reverse(): Promise<Place | null> {
        return Promise.resolve(null);
      }
    }
    const road = (id: string, name: string, lat: number, lon: number) =>
      new Place({ id, name, address: null, kind: 'address', location: { lat, lon } });
    const paulista = [
      road('osm:way:1', 'Avenida Paulista', -23.5617, -46.6559),
      road('osm:way:2', 'Avenida Paulista', -23.5562, -46.6621),
    ];
    const consolacao = [
      road('osm:way:3', 'Rua da Consolação', -23.5559, -46.6627),
      road('osm:way:4', 'Rua da Consolação', -23.546, -46.648),
    ];

    function corner(streets: Record<string, Place[]>) {
      return new SearchPlacesUseCase(
        new InMemoryGeocodeCache(),
        new StreetGeocoder(streets),
        noStops(),
        new InMemoryKnownPlaceRepository(),
        nearby(),
      );
    }

    it('"esquina da X com a Y" devolve o ponto entre os trechos mais próximos', async () => {
      const { places } = await corner({ paulista, consolação: consolacao }).execute({
        query: 'esquina da Paulista com a Consolação',
        mode: 'full',
      });
      expect(places[0]).toMatchObject({
        name: 'Avenida Paulista com Rua da Consolação',
        kind: 'address',
      });
      expect(places[0]?.location.lat).toBeCloseTo(-23.55605, 4);
    });

    it('vias longe uma da outra: ao menos a primeira via', async () => {
      const { places } = await corner({ paulista, consolação: [consolacao[1]!] }).execute({
        query: 'Paulista x Consolação',
        mode: 'full',
      });
      expect(places.map((p) => p.id)).toEqual(['osm:way:1', 'osm:way:2']);
    });
  });
});
