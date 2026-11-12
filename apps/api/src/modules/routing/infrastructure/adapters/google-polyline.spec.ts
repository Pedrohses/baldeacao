import { decodeGooglePolyline, encodeGooglePolyline } from './google-polyline';

describe('polyline do Google', () => {
  it('decodifica o exemplo da documentação', () => {
    expect(decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
      { lat: 43.252, lon: -126.453 },
    ]);
  });

  it('ida e volta com coordenadas de São Paulo', () => {
    const points = [
      { lat: -23.5505, lon: -46.6333 },
      { lat: -23.5614, lon: -46.6559 },
      { lat: -23.6, lon: -46.7202 },
    ];
    expect(decodeGooglePolyline(encodeGooglePolyline(points))).toEqual(points);
  });

  it('string vazia não tem pontos; truncada lança erro', () => {
    expect(decodeGooglePolyline('')).toEqual([]);
    expect(() => decodeGooglePolyline('_p~iF~ps|U_')).toThrow('Polyline truncada');
  });
});
