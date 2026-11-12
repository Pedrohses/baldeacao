import { PlaceSchema } from '@baldeacao/types';
import { readNominatimFixture } from '../../../../../test/support/geocoding-in-memory';
import { NominatimPlaceMapper } from './nominatim-place.mapper';
import type { NominatimSearchResult } from './nominatim.types';

const results = JSON.parse(readNominatimFixture('search-morumbis.json')) as NominatimSearchResult[];

describe('NominatimPlaceMapper', () => {
  it('converte a fixture jsonv2 em lugares válidos pelo contrato, na ordem do Nominatim', () => {
    const places = NominatimPlaceMapper.toDomainList(results);
    expect(places.map((p) => [p.id, p.kind])).toEqual([
      ['osm:way:23935207', 'poi'],
      ['osm:node:4517265781', 'stop'],
      ['osm:way:172463014', 'address'],
      ['osm:node:7015421980', 'stop'],
    ]);
    for (const place of places) expect(PlaceSchema.parse({ ...place })).toBeTruthy();
  });

  it('usa nome curto e endereço com rua, número, bairro e cidade', () => {
    const [stadium, , street] = NominatimPlaceMapper.toDomainList(results);
    expect(stadium).toMatchObject({
      name: 'Estádio do Morumbis',
      address: 'Praça Roberto Gomes Pedrosa, 1, Morumbi, São Paulo',
      location: { lat: -23.6001163, lon: -46.720235 },
    });
    expect(street).toMatchObject({
      name: 'Rua Estádio do Morumbi',
      address: 'Rua Estádio do Morumbi, Morumbi, São Paulo',
    });
  });

  it('sem name usa rua e número; sem address usa o display_name', () => {
    const house: NominatimSearchResult = {
      place_id: 1,
      osm_type: 'node',
      osm_id: 42,
      lat: '-23.56',
      lon: '-46.65',
      category: 'place',
      type: 'house',
      addresstype: 'place',
      name: '',
      display_name: '1578, Avenida Paulista, Bela Vista, São Paulo, Brasil',
      address: { house_number: '1578', road: 'Avenida Paulista', suburb: 'Bela Vista' },
    };
    expect(NominatimPlaceMapper.toDomain(house)).toMatchObject({
      id: 'osm:node:42',
      name: 'Avenida Paulista, 1578',
      address: 'Avenida Paulista, 1578, Bela Vista',
      kind: 'address',
    });
    const bare = { ...house, address: undefined, name: 'MASP' };
    expect(NominatimPlaceMapper.toDomain(bare)?.address).toBe(house.display_name);
  });

  it('descarta coordenada inválida e id repetido', () => {
    const broken = { ...results[0]!, osm_id: 1, lat: 'abc' };
    const places = NominatimPlaceMapper.toDomainList([results[0]!, results[0]!, broken]);
    expect(places).toHaveLength(1);
  });
});
