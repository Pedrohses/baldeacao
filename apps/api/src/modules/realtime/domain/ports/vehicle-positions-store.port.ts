import type { VehiclePosition } from '@baldeacao/types';

export interface StoredPositions {
  /** Último dado bom gravado (ISO 8601) ou null se a fonte nunca rodou. */
  updatedAt: string | null;
  vehicles: VehiclePosition[];
}

/** Posições correntes de cada fonte (Redis). Cada gravação substitui a foto anterior. */
export abstract class VehiclePositionsStorePort {
  abstract replace(sourceId: string, vehicles: VehiclePosition[], updatedAt: string): Promise<void>;
  abstract read(sourceId: string): Promise<StoredPositions>;
}
