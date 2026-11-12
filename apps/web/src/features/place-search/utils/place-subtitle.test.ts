import type { Place } from '@baldeacao/types';
import { describe, expect, it } from 'vitest';

import { placeSubtitle, stopKindLabel } from './place-subtitle';

const base: Place = {
  id: 'x',
  name: 'Rua Augusta, 1500',
  address: 'Consolação, São Paulo',
  kind: 'address',
  location: { lat: -23.556, lon: -46.659 },
};

describe('placeSubtitle', () => {
  it('endereço mostra a linha de endereço', () => {
    expect(placeSubtitle(base)).toBe('Consolação, São Paulo');
  });

  it('ponto de ônibus vira "Parada" e estação vira "Estação"', () => {
    expect(stopKindLabel('R. Augusta, 304')).toBe('Parada');
    expect(stopKindLabel('Av. Paulista, 1578')).toBe('Parada');
    expect(stopKindLabel('Paulista')).toBe('Estação');
    expect(
      placeSubtitle({
        ...base,
        kind: 'stop',
        name: 'R. Augusta, 17',
        address: 'Ref.: Rua Martinho Prado',
      }),
    ).toBe('Parada · Ref.: Rua Martinho Prado');
    expect(placeSubtitle({ ...base, kind: 'stop', name: 'Consolação', address: null })).toBe(
      'Estação',
    );
  });

  it('ponto sem endereço mostra as coordenadas', () => {
    expect(placeSubtitle({ ...base, kind: 'coordinates', address: null })).toBe(
      '-23,55600; -46,65900',
    );
  });
});
