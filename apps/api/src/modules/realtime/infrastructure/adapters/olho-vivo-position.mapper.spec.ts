import { VehiclePositionSchema } from '@baldeacao/types';
import { rawPositionsFixture } from '../../../../../test/realtime/in-memory-realtime';
import { mapOlhoVivoPositions } from './olho-vivo-position.mapper';

describe('mapOlhoVivoPositions', () => {
  it('converte posicao.json para VehiclePosition do contrato', () => {
    const positions = mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans');

    expect(positions).toHaveLength(4);
    for (const position of positions) VehiclePositionSchema.parse(position);
    expect(positions.find((p) => p.vehicleId === '11433')).toEqual({
      vehicleId: '11433',
      sourceId: 'sptrans',
      routeId: '875A-10',
      routeShortName: '875A-10',
      directionId: 0,
      location: { lat: -23.559, lon: -46.6612 },
      accessible: true,
      recordedAt: '2026-11-12T15:34:10Z',
    });
  });

  it('mapeia sl 2 para direction_id 1', () => {
    const positions = mapOlhoVivoPositions(rawPositionsFixture(), 'sptrans');

    expect(positions.find((p) => p.vehicleId === '11611')?.directionId).toBe(1);
  });

  it('descarta leitura inválida e fica com a última leitura de um prefixo repetido', () => {
    const raw = rawPositionsFixture();
    const [first] = raw.l;
    if (!first) throw new Error('fixture sem linhas');
    first.vs.push(
      { p: 99999, a: true, ta: 'ontem', py: -23.5, px: -46.6 },
      { p: 18048, a: false, ta: '2026-11-12T15:34:20Z', py: -23.551, px: -46.634 },
    );

    const positions = mapOlhoVivoPositions(raw, 'sptrans');

    expect(positions.map((p) => p.vehicleId)).not.toContain('99999');
    expect(positions.filter((p) => p.vehicleId === '18048')).toEqual([
      expect.objectContaining({ recordedAt: '2026-11-12T15:34:20Z', accessible: false }),
    ]);
  });
});
