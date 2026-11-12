// Chaves do tempo real no Redis (projeto.md, "Modelo de dados").
export const realtimeKeys = {
  /** Conjunto GEO com a posição de cada veículo. */
  vehicles: (sourceId: string): string => `vehicles:${sourceId}`,
  /** Linha, sentido e horário da última leitura do veículo, com expiração curta. */
  vehicle: (sourceId: string, vehicleId: string): string => `vehicle:${sourceId}:${vehicleId}`,
  /** Último dado bom da fonte. */
  updatedAt: (sourceId: string): string => `realtime:${sourceId}:updated_at`,
  /** Canal pub/sub que avisa o gateway a cada ciclo. */
  cycleChannel: (sourceId: string): string => `positions:${sourceId}`,
  cycleChannelPattern: 'positions:*',
} as const;
