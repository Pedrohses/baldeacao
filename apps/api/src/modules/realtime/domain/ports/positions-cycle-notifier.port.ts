export interface PositionsCycleEvent {
  sourceId: string;
  updatedAt: string;
  vehicleCount: number;
}

export type PositionsCycleListener = (event: PositionsCycleEvent) => void;

/** Aviso de fim de ciclo do worker para quem publica aos clientes (pub/sub positions:{source}). */
export abstract class PositionsCycleNotifierPort {
  abstract publish(event: PositionsCycleEvent): Promise<void>;
  /** Registra um ouvinte; devolve a função que cancela a inscrição. */
  abstract subscribe(listener: PositionsCycleListener): Promise<() => Promise<void>>;
}
