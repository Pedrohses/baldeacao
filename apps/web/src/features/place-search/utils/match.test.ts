import { placeDestinationExample, placeOriginExample } from '@baldeacao/types/examples';
import { describe, expect, it } from 'vitest';

import type { Place } from '@baldeacao/types';

import { highlightMatch, isStrongMatch, pickConfirmed } from './match';

describe('highlightMatch', () => {
  it('destaca o trecho digitado sem diferenciar acento e caixa', () => {
    expect(highlightMatch('Estação Sé', 'estacao')).toEqual([
      { text: 'Estação', match: true },
      { text: ' Sé', match: false },
    ]);
    expect(highlightMatch('Av. Paulista', 'xyz')).toEqual([{ text: 'Av. Paulista', match: false }]);
  });
});

const allianz: Place = {
  id: 'osm:way:1',
  name: 'Allianz Parque',
  address: 'Avenida Francisco Matarazzo, 1705, Água Branca, São Paulo',
  kind: 'poi',
  location: { lat: -23.5275, lon: -46.6783 },
};
const vergueiro: Place = {
  id: 'osm:node:2',
  name: 'Rua Vergueiro, 3185',
  address: 'Vila Mariana, São Paulo',
  kind: 'address',
  location: { lat: -23.5889, lon: -46.6343 },
};

describe('isStrongMatch', () => {
  it('exige todos os termos no nome ou endereço, sem acento e ignorando o tipo de rua', () => {
    expect(isStrongMatch(allianz, 'Allianz Parque')).toBe(true);
    expect(isStrongMatch(vergueiro, 'R. Vergueiro 3185')).toBe(true);
    expect(isStrongMatch(vergueiro, 'Rua Vergueiro 3000')).toBe(false);
    expect(isStrongMatch({ ...allianz, name: 'Mercado Municipal' }, 'Mercadão')).toBe(false);
    expect(isStrongMatch({ ...allianz, name: 'Mercadão de Pinheiros' }, 'mercadao')).toBe(true);
  });

  it('fora de São Paulo nunca é forte', () => {
    expect(isStrongMatch({ ...allianz, location: { lat: -22.9, lon: -43.2 } }, 'Allianz')).toBe(
      false,
    );
  });
});

describe('pickConfirmed', () => {
  it('escolhe o primeiro forte, sinaliza fraco ou homônimo e devolve null sem resultado', () => {
    expect(pickConfirmed([placeOriginExample, placeDestinationExample], 'morumbis')).toBe(
      placeOriginExample,
    );
    expect(pickConfirmed([placeOriginExample, placeDestinationExample], 'estadio tiete')).toBe(
      'ambiguous',
    );
    expect(
      pickConfirmed([placeOriginExample, { ...placeOriginExample, id: 'x' }], 'morumbis'),
    ).toBe('ambiguous');
    expect(pickConfirmed([], 'x')).toBeNull();
  });
});
