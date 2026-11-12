import type { Place } from '@baldeacao/types';
import { describe, expect, it } from 'vitest';

import { placeSubtitle } from './place-subtitle';

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

  it('kind stop vira "Parada" e kind station vira "Estação", sem olhar o nome', () => {
    expect(placeSubtitle({ ...base, kind: 'stop', name: 'Consolação', address: null })).toBe(
      'Parada',
    );
    expect(
      placeSubtitle({
        ...base,
        kind: 'stop',
        name: 'R. Augusta, 17',
        address: 'Ref.: Rua Martinho Prado',
      }),
    ).toBe('Parada · Ref.: Rua Martinho Prado');
    expect(placeSubtitle({ ...base, kind: 'station', name: 'Consolação', address: null })).toBe(
      'Estação',
    );
    expect(
      placeSubtitle({ ...base, kind: 'station', name: 'Paulista', address: 'Linha 4-Amarela' }),
    ).toBe('Estação · Linha 4-Amarela');
  });

  it('ponto sem endereço mostra as coordenadas', () => {
    expect(placeSubtitle({ ...base, kind: 'coordinates', address: null })).toBe(
      '-23,55600; -46,65900',
    );
  });
});
