import { Place } from '../entities/place.entity';
import { rankLocalPlaces, textTier } from './local-place-rank';
import { classifyOsmPoi, osmPoiAddress } from './osm-poi-category';

function place(id: string, name: string, lat = -23.5, lon = -46.6): Place {
  return new Place({ id, name, address: null, kind: 'poi', location: { lat, lon } });
}

describe('classifyOsmPoi', () => {
  it('classifica pelas categorias importadas, com bônus para Wikidata', () => {
    expect(classifyOsmPoi({ leisure: 'park', name: 'Parque Ibirapuera' })).toEqual({
      category: 'leisure=park',
      importance: 7,
    });
    expect(classifyOsmPoi({ leisure: 'garden', wikidata: 'Q1' })).toEqual({
      category: 'leisure=garden',
      importance: 8,
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

describe('rankLocalPlaces', () => {
  it('textTier: prefixo e início de palavra valem o mesmo; meio de palavra depois', () => {
    expect(textTier('Jardim Botânico de São Paulo', 'jardim bot')).toBe(0);
    expect(textTier('Parque do Ibirapuera', 'ibira')).toBe(0);
    expect(textTier('Shopping Ibirapuera', 'rapuera')).toBe(1);
  });

  it('início de palavra, depois estação, depois importância e nome mais curto', () => {
    const ranked = rankLocalPlaces(
      'ibirapuera',
      [
        { place: place('stop:1', 'Av. Ibirapuera, 901', -23.6), isStation: false, importance: 0 },
        {
          place: place('osm:way:2', 'Shopping Ibirapuera', -23.61),
          isStation: false,
          importance: 6,
        },
        { place: place('osm:way:3', 'Parque Ibirapuera', -23.62), isStation: false, importance: 9 },
        { place: place('stop:4', 'Moema-Ibirapuera', -23.63), isStation: true, importance: 0 },
        { place: place('osm:way:5', 'Xibirapuera', -23.64), isStation: false, importance: 9 },
      ],
      8,
    );
    expect(ranked.map((p) => p.id)).toEqual([
      'stop:4',
      'osm:way:3',
      'osm:way:2',
      'stop:1',
      'osm:way:5',
    ]);
  });

  it('não repete o mesmo lugar e respeita o limite', () => {
    const ranked = rankLocalPlaces(
      'luz',
      [
        { place: place('stop:1', 'Luz'), isStation: true, importance: 0 },
        { place: place('osm:node:2', 'Luz'), isStation: false, importance: 8 },
        { place: place('osm:way:3', 'Parque da Luz', -23.53), isStation: false, importance: 7 },
        { place: place('osm:way:4', 'Praça da Luz', -23.54), isStation: false, importance: 3 },
      ],
      2,
    );
    expect(ranked.map((p) => p.id)).toEqual(['stop:1', 'osm:way:3']);
  });
});
