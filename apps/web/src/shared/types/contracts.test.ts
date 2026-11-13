import {
  ArrivalSchema,
  LineShapeSchema,
  POSITIONS_ALL_CHANNEL,
  PositionsChannelSchema,
  PositionsSubscriptionSchema,
  PositionsUpdateSchema,
  RouteSchema,
  StopSchema,
  VehiclePositionSchema,
  VehicleSnapshotSchema,
  isSnapshotStale,
  positionsLineChannel,
  toLonLat,
} from '@baldeacao/types';
import {
  arrivalExample,
  lineShapeExample,
  positionsSubscriptionExample,
  positionsUpdateExample,
  routeExample,
  stopExample,
  vehiclePositionExample,
  vehicleSnapshotExample,
} from '@baldeacao/types/examples';

describe('contratos v1 de @baldeacao/types', () => {
  it.each([
    ['Route', RouteSchema, routeExample],
    ['Stop', StopSchema, stopExample],
    ['LineShape', LineShapeSchema, lineShapeExample],
    ['Arrival', ArrivalSchema, arrivalExample],
    ['VehiclePosition', VehiclePositionSchema, vehiclePositionExample],
    ['VehicleSnapshot', VehicleSnapshotSchema, vehicleSnapshotExample],
    ['PositionsSubscription', PositionsSubscriptionSchema, positionsSubscriptionExample],
    ['PositionsUpdate', PositionsUpdateSchema, positionsUpdateExample],
  ] as const)('aceita o exemplo de %s', (_name, schema, example) => {
    expect(schema.parse(example)).toEqual(example);
  });

  it('previsão sem cor de linha (api anterior às cores) vira cor nula', () => {
    const withoutColors: Record<string, unknown> = { ...arrivalExample };
    delete withoutColors.routeColor;
    delete withoutColors.routeTextColor;
    expect(ArrivalSchema.parse(withoutColors)).toMatchObject({
      routeColor: null,
      routeTextColor: null,
    });
  });

  it('rejeita data fora de ISO 8601 e coordenada inválida', () => {
    expect(
      VehiclePositionSchema.safeParse({ ...vehiclePositionExample, recordedAt: '12/11/2026' })
        .success,
    ).toBe(false);
    expect(StopSchema.safeParse({ ...stopExample, location: { lat: -123, lon: 0 } }).success).toBe(
      false,
    );
  });

  it('monta e valida nomes de canal', () => {
    expect(positionsLineChannel('875A-10')).toBe('positions:line:875A-10');
    expect(() => positionsLineChannel('a:b')).toThrow();
    expect(PositionsChannelSchema.safeParse(POSITIONS_ALL_CHANNEL).success).toBe(true);
    expect(PositionsChannelSchema.safeParse('positions:line:').success).toBe(false);
    expect(PositionsChannelSchema.safeParse('positions:other').success).toBe(false);
  });

  it('calcula isStale a partir de updatedAt', () => {
    const updatedAt = '2026-11-12T11:40:00Z';
    expect(isSnapshotStale({ updatedAt }, new Date('2026-11-12T11:41:00Z'))).toBe(false);
    expect(isSnapshotStale({ updatedAt }, new Date('2026-11-12T11:42:00Z'))).toBe(true);
  });

  it('converte para [lon, lat]', () => {
    expect(toLonLat({ lat: -23.5, lon: -46.6 })).toEqual([-46.6, -23.5]);
  });
});
