import type { Coordinates } from '../../domain/entities/place.entity';

export interface ResolvePlaceAccessInput {
  /** Ponto de origem ou destino como veio da busca, do mapa ou do MCP. */
  location: Coordinates;
}

export interface ResolvePlaceAccessOutput {
  /** Ponto que o planejador deve usar (a parada ou estação de acesso, ou o próprio ponto). */
  location: Coordinates;
  /** Acesso pela estação que atende o aeroporto: falta o ônibus gratuito até os terminais. */
  airportShuttle: boolean;
}
