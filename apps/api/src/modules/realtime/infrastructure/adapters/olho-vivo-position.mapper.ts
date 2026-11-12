import { VehiclePositionSchema, type VehiclePosition } from '@baldeacao/types';
import type { OlhoVivoRawPositions } from '../../../../shared/infrastructure/olho-vivo/olho-vivo.types';

/**
 * Converte a resposta de /Posicao para o contrato.
 * - routeId e routeShortName: letreiro `c` (ex.: "875A-10"), igual ao route_id do GTFS da SPTrans.
 * - sentido: `sl` 1 vira direction_id 0 e `sl` 2 vira 1.
 * Leituras inválidas são descartadas; prefixo repetido fica com a última leitura.
 */
export function mapOlhoVivoPositions(
  raw: OlhoVivoRawPositions,
  sourceId: string,
): VehiclePosition[] {
  const byVehicle = new Map<string, VehiclePosition>();
  for (const line of raw.l ?? []) {
    for (const vehicle of line.vs ?? []) {
      const parsed = VehiclePositionSchema.safeParse({
        vehicleId: String(vehicle.p),
        sourceId,
        routeId: line.c,
        routeShortName: line.c,
        directionId: line.sl === 2 ? 1 : 0,
        location: { lat: vehicle.py, lon: vehicle.px },
        accessible: typeof vehicle.a === 'boolean' ? vehicle.a : null,
        recordedAt: vehicle.ta,
      });
      if (parsed.success) byVehicle.set(parsed.data.vehicleId, parsed.data);
    }
  }
  return [...byVehicle.values()];
}
