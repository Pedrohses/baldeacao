import { Place, type PlaceKind } from '../entities/place.entity';
import {
  analyzePlaceQuery,
  type PlaceCandidate,
  placeTokens,
  rankPlaces,
  scorePlaceCandidate,
} from './local-place-rank';

interface Seed {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind?: PlaceKind;
  address?: string | null;
  aliases?: string[];
  importance?: number;
  inCity?: boolean | null;
  remoteIndex?: number | null;
}

function candidate(seed: Seed): PlaceCandidate {
  return {
    place: new Place({
      id: seed.id,
      name: seed.name,
      address: seed.address ?? null,
      kind: seed.kind ?? 'poi',
      location: { lat: seed.lat, lon: seed.lon },
    }),
    aliases: seed.aliases ?? [],
    importance: seed.importance ?? 0,
    inCity: seed.inCity ?? true,
    remoteIndex: seed.remoteIndex ?? null,
  };
}

function first(query: string, seeds: Seed[]): string | undefined {
  return rankPlaces(query, seeds.map(candidate), 8)[0]?.id;
}

describe('analyzePlaceQuery', () => {
  it('separa termos e número de casa, expandindo abreviações e tirando CEP', () => {
    expect(analyzePlaceQuery('Rua Vergueiro 3185')).toEqual({
      terms: ['rua', 'vergueiro'],
      houseNumber: '3185',
    });
    expect(analyzePlaceQuery('Avenida Paulista, 900')).toEqual({
      terms: ['avenida', 'paulista'],
      houseNumber: '900',
    });
    expect(analyzePlaceQuery('R. Teodoro Sampaio 1020').terms).toEqual([
      'rua',
      'teodoro',
      'sampaio',
    ]);
    expect(analyzePlaceQuery('Av. Miguel Estefno, 3031 - Vila Água Funda, 04301-905')).toEqual({
      terms: ['avenida', 'miguel', 'estefno', 'vila', 'agua', 'funda'],
      houseNumber: '3031',
    });
  });

  it('número no meio do nome não é número de casa', () => {
    expect(analyzePlaceQuery('Rua 25 de Março')).toEqual({
      terms: ['rua', '25', 'marco'],
      houseNumber: null,
    });
    expect(analyzePlaceQuery('MASP').houseNumber).toBeNull();
  });

  it('placeTokens tira acento, artigos e expande "Av." e "R."', () => {
    expect(placeTokens('R. Vergueiro, 356')).toEqual(['rua', 'vergueiro', '356']);
    expect(placeTokens('Sesc Av. Paulista')).toEqual(['sesc', 'avenida', 'paulista']);
  });
});

// Casos do relatório de QA, com coordenadas e categorias reais do recorte OSM.
describe('rankPlaces (casos do QA)', () => {
  const mercadao = {
    id: 'osm:relation:4602996',
    name: 'Mercado Municipal de São Paulo',
    lat: -23.5417,
    lon: -46.6297,
    aliases: ['Mercado Municipal Paulistano', 'Mercado Municipal', 'Mercadão'],
    importance: 7,
  };
  const vilaArens = {
    id: 'osm:way:398442647',
    name: 'Mercadão Vila Arens',
    lat: -23.19,
    lon: -46.89,
    importance: 5,
    inCity: false,
  };

  it('"Mercadão" é o Mercado Municipal de SP (apelido), não o Mercadão de Jundiaí', () => {
    const lapa = {
      id: 'osm:way:520679189',
      name: 'Mercado Municipal da Lapa',
      lat: -23.523,
      lon: -46.703,
      aliases: ['Mercado Municipal', 'Mercadão'],
      importance: 7,
    };
    expect(first('Mercadão', [vilaArens, lapa, mercadao])).toBe(mercadao.id);
    expect(first('mercadao', [vilaArens, mercadao])).toBe(mercadao.id);
  });

  it('"Allianz Parque" é o Nubank Parque (old_name), não um parque qualquer', () => {
    const nubank = {
      id: 'osm:way:231044849',
      name: 'Nubank Parque',
      lat: -23.5275,
      lon: -46.6785,
      aliases: ['Arena do Palmeiras', 'Allianz Parque'],
      importance: 9,
    };
    const volpi = {
      id: 'osm:way:2',
      name: 'Parque Alfredo Volpi',
      lat: -23.587,
      lon: -46.703,
      importance: 9,
    };
    expect(first('Allianz Parque', [volpi, nubank])).toBe(nubank.id);
  });

  it('"MASP" é o Museu de Arte (short_name), não Mascarenhas de Santos', () => {
    const masp = {
      id: 'osm:way:1370081491',
      name: 'Museu de Arte de São Paulo',
      lat: -23.5614,
      lon: -46.6559,
      aliases: ['MASP', 'Museu de Arte de São Paulo Assis Chateaubriand'],
      importance: 8,
    };
    const mascarenhas = {
      id: 'osm:way:3',
      name: 'Praça Mascarenhas de Moraes',
      lat: -23.96,
      lon: -46.33,
      importance: 3,
      inCity: false,
    };
    expect(first('MASP', [mascarenhas, masp])).toBe(masp.id);
  });

  it('"Zoológico" é o de SP, acima do de Guarulhos e da parada de ônibus', () => {
    const zoo = {
      id: 'osm:way:75354058',
      name: 'Jardim Zoológico de São Paulo',
      lat: -23.6505,
      lon: -46.62,
      importance: 9,
    };
    const guarulhos = {
      id: 'osm:way:408375368',
      name: 'Zoológico de Guarulhos',
      lat: -23.43,
      lon: -46.55,
      importance: 7,
      inCity: false,
    };
    const stop = {
      id: 'stop:1',
      name: 'Zoológico',
      lat: -23.651,
      lon: -46.621,
      kind: 'stop' as const,
    };
    expect(first('Zoológico', [guarulhos, stop, zoo])).toBe(zoo.id);
  });

  it('"Centro" é o centro histórico (Sé), não "Centro Esportivo..." nem o Centro de Santos', () => {
    // Na capital o OSM não tem bairro "Centro": a importação dá à Sé o apelido "Centro".
    const se = {
      id: 'osm:node:1',
      name: 'Sé',
      lat: -23.5503,
      lon: -46.6339,
      kind: 'address' as const,
      aliases: ['Centro', 'Centro Histórico'],
      importance: 5,
    };
    const santos = {
      id: 'osm:node:615751797',
      name: 'Centro',
      lat: -23.93,
      lon: -46.33,
      kind: 'address' as const,
      importance: 7,
      inCity: false,
    };
    const esportivo = {
      id: 'osm:way:4',
      name: 'Centro Esportivo, Recreativo e Educativo do Trabalhador',
      lat: -23.53,
      lon: -46.6,
      importance: 9,
    };
    expect(first('Centro', [esportivo, santos, se])).toBe(se.id);
  });

  it('endereço com número: o do Nominatim com o mesmo número, e a parada de outro número cai', () => {
    const stop356 = {
      id: 'stop:2',
      name: 'R. Vergueiro, 356',
      lat: -23.567,
      lon: -46.64,
      kind: 'stop' as const,
    };
    const address = {
      id: 'osm:node:5',
      name: 'Rua Vergueiro, 3185',
      address: 'Rua Vergueiro, 3185, Vila Mariana, São Paulo',
      lat: -23.588,
      lon: -46.634,
      kind: 'address' as const,
      remoteIndex: 1,
    };
    const street = {
      id: 'osm:way:6',
      name: 'Rua Vergueiro',
      address: 'Rua Vergueiro, Liberdade, São Paulo',
      lat: -23.57,
      lon: -46.64,
      kind: 'address' as const,
      remoteIndex: 0,
    };
    expect(first('Rua Vergueiro 3185', [stop356, street, address])).toBe(address.id);
  });

  it('"Avenida Paulista, 900" fica com o número 900, não com o Sesc Av. Paulista 119', () => {
    const sesc = {
      id: 'stop:3',
      name: 'Sesc Av. Paulista 119',
      lat: -23.5705,
      lon: -46.6455,
      kind: 'stop' as const,
    };
    const paulista900 = {
      id: 'osm:node:7',
      name: 'Avenida Paulista, 900',
      address: 'Avenida Paulista, 900, Bela Vista, São Paulo',
      lat: -23.5649,
      lon: -46.6521,
      kind: 'address' as const,
      remoteIndex: 0,
    };
    expect(first('Avenida Paulista, 900', [sesc, paulista900])).toBe(paulista900.id);
  });

  it('no full, Nominatim que casa todos os termos fica acima de local com trigrama solto', () => {
    const weakLocal = candidate({
      id: 'osm:way:8',
      name: 'Parque Teodoro',
      lat: -23.55,
      lon: -46.63,
      importance: 9,
    });
    const remote = candidate({
      id: 'osm:way:9',
      name: 'Rua Teodoro Sampaio',
      address: 'Rua Teodoro Sampaio, Pinheiros, São Paulo',
      lat: -23.56,
      lon: -46.68,
      kind: 'address',
      remoteIndex: 3,
    });
    const query = analyzePlaceQuery('R. Teodoro Sampaio');
    expect(scorePlaceCandidate(remote, query)).toBeGreaterThan(
      scorePlaceCandidate(weakLocal, query),
    );
  });

  it('estação vem antes da parada de ônibus de mesmo nome; não repete o mesmo lugar', () => {
    const ranked = rankPlaces(
      'Luz',
      [
        candidate({ id: 'stop:10', name: 'Luz', lat: -23.5348, lon: -46.6355, kind: 'stop' }),
        candidate({
          id: 'stop:11',
          name: 'Luz',
          lat: -23.5352,
          lon: -46.6337,
          kind: 'station',
          importance: 8,
        }),
        candidate({ id: 'osm:way:12', name: 'Parque da Luz', lat: -23.533, lon: -46.634 }),
      ],
      8,
    );
    expect(ranked.map((p) => p.id)).toEqual(['stop:11', 'osm:way:12']);
  });

  it('lugar local forte vence POI do Nominatim sem categoria (táxi, POI sem tipo)', () => {
    const tiete = candidate({
      id: 'osm:relation:8546826',
      name: 'Terminal Rodoviário Tietê',
      lat: -23.5163,
      lon: -46.6237,
      importance: 10,
    });
    const taxi = candidate({
      id: 'osm:node:5151527015',
      name: 'Ponto de Táxi Rodoviaria do Tiete',
      lat: -23.5161,
      lon: -46.6231,
      importance: 4,
      remoteIndex: 0,
    });
    expect(rankPlaces('Rodoviária do Tietê', [taxi, tiete], 8)[0]?.id).toBe(tiete.place.id);

    const park = {
      ...candidate({
        id: 'osm:way:125450993',
        name: 'Parque Ibirapuera',
        lat: -23.588,
        lon: -46.6593,
        importance: 9,
      }),
      category: 'leisure=park',
    };
    const bare = candidate({
      id: 'osm:node:2540462440',
      name: 'Ibirapuera',
      lat: -23.5817,
      lon: -46.66,
      importance: 4,
      remoteIndex: 0,
    });
    expect(rankPlaces('Ibirapuera', [bare, park], 8)[0]?.id).toBe(park.place.id);
  });

  it('fora do município sai quando há match forte na cidade e ele é fraco', () => {
    const ranked = rankPlaces(
      'Estádio do Morumbis',
      [
        candidate({
          id: 'a',
          name: 'MorumBIS',
          lat: -23.6,
          lon: -46.72,
          importance: 9,
          aliases: ['Estádio do Morumbi'],
        }),
        candidate({
          id: 'b',
          name: 'Estádio Ulrico Mursa',
          lat: -23.947,
          lon: -46.337,
          importance: 9,
          inCity: false,
        }),
      ],
      8,
    );
    expect(ranked.map((p) => p.id)).toEqual(['a']);
  });

  it('junta a mesma estação escrita com e sem espaço no hífen', () => {
    const ranked = rankPlaces(
      'Palmeiras Barra Funda',
      [
        candidate({
          id: 'stop:18986',
          name: 'Palmeiras - Barra Funda',
          lat: -23.5257,
          lon: -46.6668,
          kind: 'station',
          importance: 8,
        }),
        candidate({
          id: 'stop:614606',
          name: 'Palmeiras-Barra Funda',
          lat: -23.5253,
          lon: -46.6672,
          kind: 'station',
          importance: 8,
        }),
      ],
      8,
    );
    expect(ranked).toHaveLength(1);
  });
});
