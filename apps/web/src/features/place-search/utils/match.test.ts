import { placeDestinationExample, placeOriginExample } from '@baldeacao/types/examples';
import { describe, expect, it } from 'vitest';

import { highlightMatch, pickConfirmed } from './match';

describe('highlightMatch', () => {
  it('destaca o trecho digitado sem diferenciar acento e caixa', () => {
    expect(highlightMatch('Estação Sé', 'estacao')).toEqual([
      { text: 'Estação', match: true },
      { text: ' Sé', match: false },
    ]);
    expect(highlightMatch('Av. Paulista', 'xyz')).toEqual([{ text: 'Av. Paulista', match: false }]);
  });
});

describe('pickConfirmed', () => {
  it('escolhe o primeiro, sinaliza homônimos e devolve null sem resultado', () => {
    expect(pickConfirmed([placeOriginExample, placeDestinationExample])).toBe(placeOriginExample);
    expect(pickConfirmed([placeOriginExample, { ...placeOriginExample, id: 'x' }])).toBe(
      'ambiguous',
    );
    expect(pickConfirmed([])).toBeNull();
  });
});
