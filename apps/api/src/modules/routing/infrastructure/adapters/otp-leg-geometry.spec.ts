import { encodeGooglePolyline } from './google-polyline';
import { OtpItineraryMapper } from './otp-itinerary.mapper';
import type { OtpLeg } from './otp.types';

const time = (t: string) => ({ scheduledTime: t, estimated: null });
const bras = { lat: -23.5454, lon: -46.6162 };
const tatuape = { lat: -23.54, lon: -46.5764 };
const goulart = { lat: -23.4982, lon: -46.52 };

function railLeg(points: Array<{ lat: number; lon: number }>): OtpLeg {
  return {
    mode: 'RAIL',
    transitLeg: true,
    realTime: false,
    duration: 720,
    distance: 8879,
    headsign: 'Calmon Viana',
    start: time('2026-11-13T06:42:00-03:00'),
    end: time('2026-11-13T06:54:00-03:00'),
    from: { name: 'Brás', ...bras, stop: { gtfsId: 'sptrans:1' } },
    to: { name: 'Eng. Goulart', ...goulart, stop: { gtfsId: 'sptrans:2' } },
    route: { gtfsId: 'sptrans:CPTM L12', shortName: 'CPTM L12', longName: null, color: '083E89' },
    intermediateStops: [],
    legGeometry: { points: encodeGooglePolyline(points) },
  };
}

describe('geometria do trecho com traçado incompleto no GTFS', () => {
  it('liga o embarque (Brás) ao início do traçado (Tatuapé)', () => {
    const leg = OtpItineraryMapper.toLeg(railLeg([tatuape, goulart]));
    expect(leg.points[0]).toEqual({ lat: bras.lat, lon: bras.lon });
    expect(leg.points).toHaveLength(3);
  });

  it('não mexe quando o traçado já encosta nas paradas', () => {
    const leg = OtpItineraryMapper.toLeg(railLeg([bras, tatuape, goulart]));
    expect(leg.points).toHaveLength(3);
  });
});
