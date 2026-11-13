/**
 * Limites por IP, numa janela de 1 minuto (estado em memória do processo; a api roda num
 * processo só). `api` vale para a REST toda; `heavy` soma-se nas rotas marcadas com
 * @HeavyRoute (as que ocupam o OTP ou o Nominatim); `mcp` vale só para /mcp.
 */
export const THROTTLES = {
  /** O site pede previsões de até 8 paradas a cada 15 s: 600/min deixa muita folga. */
  api: { name: 'api', ttl: 60_000, limit: 600 },
  heavy: { name: 'heavy', ttl: 60_000, limit: 30 },
  mcp: { name: 'mcp', ttl: 60_000, limit: 60 },
} as const;

export const MCP_PATH_PREFIX = '/mcp';
/** Fora de todos os limites: monitoramento chama sem parar. */
export const UNLIMITED_PATH_PREFIXES = ['/health'] as const;
