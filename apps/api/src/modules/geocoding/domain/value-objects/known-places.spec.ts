import { classifyOsmPoi, osmPoiAddress, osmPoiAliases } from './osm-poi-category';

describe('classifyOsmPoi', () => {
  it('classifica pelas categorias importadas, com bônus para Wikidata', () => {
    expect(classifyOsmPoi({ leisure: 'park', name: 'Parque Ibirapuera' })).toEqual({
      category: 'leisure=park',
      importance: 7,
      kind: 'poi',
    });
    expect(classifyOsmPoi({ railway: 'station' })?.kind).toBe('station');
    expect(classifyOsmPoi({ place: 'suburb', name: 'Centro' })).toEqual({
      category: 'place=suburb',
      importance: 5,
      kind: 'address',
    });
    expect(classifyOsmPoi({ leisure: 'garden', wikidata: 'Q1' })).toEqual({
      category: 'leisure=garden',
      importance: 8,
      kind: 'poi',
    });
    expect(classifyOsmPoi({ historic: 'memorial' })?.category).toBe('historic=memorial');
  });

  it('ignora o que não é das categorias', () => {
    expect(classifyOsmPoi({ amenity: 'bench' })).toBeNull();
    expect(classifyOsmPoi({ highway: 'bus_stop' })).toBeNull();
    expect(classifyOsmPoi({ historic: 'no' })).toBeNull();
  });
});

describe('osmPoiAddress', () => {
  it('monta rua e número, bairro e cidade', () => {
    expect(
      osmPoiAddress({
        'addr:street': 'Avenida Miguel Estéfano',
        'addr:housenumber': '3031',
        'addr:suburb': 'Água Funda',
        'addr:city': 'São Paulo',
      }),
    ).toEqual({
      address: 'Avenida Miguel Estéfano, 3031, Água Funda, São Paulo',
      suburb: 'Água Funda',
      city: 'São Paulo',
    });
    expect(osmPoiAddress({})).toEqual({ address: null, suburb: null, city: null });
  });
});

describe('osmPoiAliases', () => {
  it('junta alt_name, short_name, official_name, old_name e loc_name, sem repetir o nome', () => {
    expect(
      osmPoiAliases({
        name: 'Mercado Municipal de São Paulo',
        alt_name: 'Mercado Municipal Paulistano;Mercado de São Paulo',
        loc_name: 'Mercadão',
        short_name: 'Mercado Municipal',
        official_name: 'mercado municipal de são paulo',
      }),
    ).toEqual([
      'Mercado Municipal Paulistano',
      'Mercado de São Paulo',
      'Mercado Municipal',
      'Mercadão',
    ]);
    expect(osmPoiAliases({ name: 'Nubank Parque', old_name: 'Allianz Parque' })).toEqual([
      'Allianz Parque',
    ]);
    expect(osmPoiAliases({ name: 'X' })).toEqual([]);
  });
});
