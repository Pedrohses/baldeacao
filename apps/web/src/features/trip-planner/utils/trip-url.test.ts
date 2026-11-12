import { stopExample } from '@baldeacao/types/examples';
import { describe, expect, it } from 'vitest';

import { buildTripHref, parseTripSearchParams } from './trip-url';

const stopPlace = {
  id: `stop:${stopExample.id}`,
  name: stopExample.name,
  address: null,
  kind: 'stop' as const,
  location: stopExample.location,
};

function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, 'http://app.test').searchParams);
}

describe('URL da viagem', () => {
  it('monta o link com para, paraNome e paraTipo e origem "minha localização"', () => {
    const href = buildTripHref({ from: 'current-location', to: stopPlace, focus: 'destination' });
    expect(href.startsWith('/viagem?')).toBe(true);
    expect(paramsOf(href)).toEqual({
      de: 'minha-localizacao',
      para: '-23.561400,-46.655900',
      paraNome: 'Av. Paulista 1578',
      paraTipo: 'stop',
      foco: 'destino',
    });
    expect(buildTripHref()).toBe('/viagem');
  });

  it('lê de volta o que montou (ida e volta)', () => {
    const parsed = parseTripSearchParams(paramsOf(buildTripHref({ from: stopPlace })));
    expect(parsed.origin).toMatchObject({
      name: 'Av. Paulista 1578',
      kind: 'stop',
      location: { lat: -23.5614, lon: -46.6559 },
    });
    expect(parsed.destination).toBeNull();
    expect(parsed.focus).toBeNull();
  });

  it('usa "Ponto no mapa" e coordenadas quando faltam nome e tipo', () => {
    const parsed = parseTripSearchParams({ para: '-23.55,-46.63', paraTipo: 'qualquer' });
    expect(parsed.destination).toMatchObject({
      name: 'Ponto no mapa',
      kind: 'coordinates',
      location: { lat: -23.55, lon: -46.63 },
    });
  });

  it('ignora coordenadas inválidas e lê "minha localização" e o foco', () => {
    expect(parseTripSearchParams({ de: 'abc', para: '-123,10' })).toEqual({
      origin: null,
      destination: null,
      focus: null,
    });
    expect(parseTripSearchParams({ de: 'minha-localizacao', foco: 'destino' })).toEqual({
      origin: 'current-location',
      destination: null,
      focus: 'destination',
    });
    expect(parseTripSearchParams({ de: ['-23.5,-46.6', 'x'] }).origin).not.toBeNull();
  });
});
