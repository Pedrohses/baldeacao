import type { VehiclePosition } from '@baldeacao/types';

/** Fonte externa de posições em tempo real (ex.: Olho Vivo). */
export abstract class VehiclePositionsSourcePort {
  abstract readonly sourceId: string;
  abstract fetchPositions(): Promise<VehiclePosition[]>;
}
