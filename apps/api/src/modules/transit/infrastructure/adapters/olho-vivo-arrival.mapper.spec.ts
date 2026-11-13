import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ArrivalSchema } from '@baldeacao/types';
import { arrivalExample } from '@baldeacao/types/examples';
import { OlhoVivoStopForecastSchema, toArrivals } from './olho-vivo-arrival.mapper';

const FIXTURE = join(__dirname, '../../../../../test/fixtures/olho-vivo/previsao-parada.json');
const forecast = OlhoVivoStopForecastSchema.parse(JSON.parse(readFileSync(FIXTURE, 'utf8')));

describe('toArrivals (Previsao/Parada)', () => {
  // hr da fixture é 12:34 em São Paulo (15:34 UTC).
  const now = new Date('2026-11-12T15:34:30Z');

  it('converte a fixture no contrato Arrival', () => {
    const arrivals = toArrivals(forecast, '4301848', now);

    expect(arrivals).toHaveLength(2);
    for (const arrival of arrivals) ArrivalSchema.parse({ ...arrival });
    expect({ ...arrivals[0] }).toEqual({
      ...arrivalExample,
      // O letreiro vem da Olho Vivo como está, em maiúsculas.
      headsign: 'AEROPORTO',
      // A Olho Vivo não traz a cor: quem acrescenta é o caso de uso, a partir do GTFS.
      routeColor: null,
      routeTextColor: null,
    });
    expect({ ...arrivals[1] }).toMatchObject({
      vehicleId: '11502',
      expectedAt: '2026-11-12T12:44:00-03:00',
      accessible: false,
      vehicleLocation: { lat: -23.5455, lon: -46.6685 },
    });
  });

  it('sl 2 vira directionId 1 com destino lt0', () => {
    const [line] = forecast.p!.l;
    const arrivals = toArrivals(
      { ...forecast, p: { ...forecast.p!, l: [{ ...line!, sl: 2 }] } },
      '4301848',
      now,
    );
    expect(arrivals.map((a) => [a.directionId, a.headsign])).toEqual([
      [1, 'PERDIZES'],
      [1, 'PERDIZES'],
    ]);
  });

  it('passa a previsão para o dia seguinte quando cruza a meia-noite', () => {
    const [line] = forecast.p!.l;
    const lateNight = {
      hr: '23:55',
      p: {
        ...forecast.p!,
        l: [{ ...line!, vs: [{ ...line!.vs[0]!, t: '00:07' }] }],
      },
    };
    // 23:55:30 em São Paulo = 02:55:30 UTC do dia seguinte.
    const [arrival] = toArrivals(lateNight, '4301848', new Date('2026-11-13T02:55:30Z'));
    expect(arrival?.expectedAt).toBe('2026-11-13T00:07:00-03:00');

    // hr ainda de ontem, relógio local já depois da meia-noite.
    const [after] = toArrivals(lateNight, '4301848', new Date('2026-11-13T03:00:30Z'));
    expect(after?.expectedAt).toBe('2026-11-13T00:07:00-03:00');
  });

  it('parada desconhecida (p null) não tem previsão', () => {
    expect(toArrivals({ hr: '12:34', p: null }, '1', now)).toEqual([]);
  });
});
