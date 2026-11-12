import { describe, expect, it } from 'vitest';

import { darkStyleUrl } from './map-colors';

describe('darkStyleUrl', () => {
  it('troca positron por dark no fim da URL do OpenFreeMap', () => {
    expect(darkStyleUrl('https://tiles.openfreemap.org/styles/positron')).toBe(
      'https://tiles.openfreemap.org/styles/dark',
    );
    expect(darkStyleUrl('https://tiles.openfreemap.org/styles/positron/')).toBe(
      'https://tiles.openfreemap.org/styles/dark/',
    );
  });

  it('mantém estilos que não terminam em positron', () => {
    expect(darkStyleUrl('https://tiles.openfreemap.org/styles/liberty')).toBe(
      'https://tiles.openfreemap.org/styles/liberty',
    );
    expect(darkStyleUrl('https://exemplo.test/positron-x/style.json')).toBe(
      'https://exemplo.test/positron-x/style.json',
    );
  });
});
