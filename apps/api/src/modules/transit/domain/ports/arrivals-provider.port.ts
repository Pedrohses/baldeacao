import type { Arrival } from '../entities/arrival.entity';

export abstract class ArrivalsProvider {
  /**
   * Previsões de chegada na parada, em qualquer ordem. Lista vazia quando a fonte não conhece
   * a parada ou não há veículo a caminho; SourceUnavailableError quando a fonte falha.
   */
  abstract forStop(stopId: string): Promise<Arrival[]>;
}
