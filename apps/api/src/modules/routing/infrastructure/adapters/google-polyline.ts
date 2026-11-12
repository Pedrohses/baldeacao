import type { Coordinates } from '../../domain/entities/itinerary.entity';

/**
 * Decodifica uma polyline codificada do Google (precisão 5, o formato do `legGeometry.points`
 * do OpenTripPlanner). Lança Error se a string terminar no meio de um valor.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodeGooglePolyline(encoded: string, precision = 5): Coordinates[] {
  const factor = 10 ** precision;
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  const nextValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) throw new Error('Polyline truncada');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += nextValue();
    lon += nextValue();
    points.push({ lat: lat / factor, lon: lon / factor });
  }
  return points;
}

/** Codificação inversa (usada nos testes e para montar fixtures). */
export function encodeGooglePolyline(points: Coordinates[], precision = 5): string {
  const factor = 10 ** precision;
  let output = '';
  let prevLat = 0;
  let prevLon = 0;
  const encodeValue = (value: number): void => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      output += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    output += String.fromCharCode(v + 63);
  };
  for (const point of points) {
    const lat = Math.round(point.lat * factor);
    const lon = Math.round(point.lon * factor);
    encodeValue(lat - prevLat);
    encodeValue(lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }
  return output;
}
