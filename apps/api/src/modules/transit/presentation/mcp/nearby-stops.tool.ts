import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { cityInput, resolveCity, unsupportedCityMessage } from '../../../../mcp/city';
import { McpTool } from '../../../../mcp/mcp-tool';
import { runTool, toolError, toolText } from '../../../../mcp/tool-result';
import {
  FindNearbyStopsUseCase,
  NEARBY_DEFAULT_RADIUS_M,
  NEARBY_MAX_RADIUS_M,
} from '../../application/use-cases/find-nearby-stops.use-case';

const DEFAULT_LIMIT = 10;

const inputSchema = {
  latitude: z.number().min(-90).max(90).describe('Latitude em graus decimais, ex.: -23.5614.'),
  longitude: z.number().min(-180).max(180).describe('Longitude em graus decimais, ex.: -46.6559.'),
  raio_metros: z
    .number()
    .int()
    .min(50)
    .max(NEARBY_MAX_RADIUS_M)
    .optional()
    .describe(
      `Raio da busca em metros (padrão ${NEARBY_DEFAULT_RADIUS_M}, máximo ${NEARBY_MAX_RADIUS_M}).`,
    ),
  limite: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(`Máximo de paradas na resposta (padrão ${DEFAULT_LIMIT}).`),
  cidade: cityInput,
};

const outputSchema = {
  cidade: z.string(),
  raio_metros: z.number(),
  paradas: z.array(
    z.object({
      codigo: z.string().describe('Código da parada para previsao_chegada.'),
      nome: z.string(),
      descricao: z.string().nullable(),
      distancia_metros: z.number(),
      latitude: z.number(),
      longitude: z.number(),
    }),
  ),
};

@Injectable()
export class NearbyStopsTool extends McpTool {
  readonly name = 'paradas_proximas';
  private readonly logger = new Logger(NearbyStopsTool.name);

  constructor(private readonly findNearbyStops: FindNearbyStopsUseCase) {
    super();
  }

  register(server: McpServer): void {
    server.registerTool(
      this.name,
      {
        title: 'Paradas próximas',
        description:
          'Lista os pontos de ônibus e estações perto de uma coordenada, do mais perto ao mais longe ' +
          '(ex.: "Quais pontos tem perto de mim?"). Devolve o código de cada parada, usado em previsao_chegada.',
        inputSchema,
        outputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      ({ latitude, longitude, raio_metros, limite, cidade }) =>
        runTool(this.logger, this.name, async () => {
          const city = resolveCity(cidade);
          if (!city) return toolError(unsupportedCityMessage(cidade));

          const radiusM = raio_metros ?? NEARBY_DEFAULT_RADIUS_M;
          const { stops } = await this.findNearbyStops.execute({
            center: { lat: latitude, lon: longitude },
            radiusM,
            limit: limite ?? DEFAULT_LIMIT,
          });
          const paradas = stops.map(({ stop, distanceM }) => ({
            codigo: stop.id,
            nome: stop.name,
            descricao: stop.description,
            distancia_metros: Math.round(distanceM),
            latitude: stop.location.lat,
            longitude: stop.location.lon,
          }));
          const structured = { cidade: city.name, raio_metros: radiusM, paradas };

          if (paradas.length === 0) {
            return toolText(
              `Não encontrei paradas a até ${radiusM} m desse ponto. ` +
                `Tente um raio maior (até ${NEARBY_MAX_RADIUS_M} m).`,
              structured,
            );
          }
          const header =
            paradas.length === 1
              ? `1 parada a até ${radiusM} m:`
              : `${paradas.length} paradas a até ${radiusM} m, da mais perto à mais longe:`;
          const items = paradas.map(
            (p) =>
              `- ${p.codigo}: ${p.nome}${p.descricao ? ` (${p.descricao})` : ''}, a ${p.distancia_metros} m`,
          );
          return toolText([header, ...items].join('\n'), structured);
        }),
    );
  }
}
