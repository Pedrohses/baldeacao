import { routeTypeFromGtfs } from './route-type';

describe('routeTypeFromGtfs', () => {
  it.each([
    [0, 'tram'],
    [1, 'subway'],
    [2, 'rail'],
    [3, 'bus'],
    [4, 'ferry'],
    [11, 'trolleybus'],
    [109, 'rail'],
    [401, 'subway'],
    [700, 'bus'],
    [800, 'trolleybus'],
    [900, 'tram'],
    [1200, 'ferry'],
    [6, 'bus'],
  ] as const)('route_type %p vira %p', (code, type) => {
    expect(routeTypeFromGtfs(code)).toBe(type);
  });
});
