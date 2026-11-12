import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { cityInput, resolveCity, unsupportedCityMessage } from '../../../../mcp/city';
import { formatClock } from '../../../../mcp/format';
import { McpTool } from '../../../../mcp/mcp-tool';
import { runTool, toolError, toolText } from '../../../../mcp/tool-result';
import { GetStopArrivalsUseCase } from '../../application/use-cases/get-stop-arrivals.use-case';
import type { Arrival } from '../../domain/entities/arrival.entity';

const MAX_ARRIVALS = 15;

const inputSchema = {
  parada: z
    .string()
    .trim()
    .min(1, 'Informe o código da parada.')
    .max(32)
    .describe('Código da parada, como devolvido por paradas_proximas (ex.: "4301848").'),
  linha: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .optional()
    .describe('Mostra só uma linha: número (ex.: "875A") ou código completo (ex.: "875A-10").'),
  cidade: cityInput,
};

const outputSchema = {
  cidade: z.string(),
  parada: z.string(),
  chegadas: z.array(
    z.object({
      linha: z.string(),
      destino: z.string().nullable(),
      previsto_para: z.string().describe('ISO 8601.'),
      minutos: z.number().describe('Minutos a partir de agora; 0 quando está chegando.'),
      tempo_real: z.boolean(),
      veiculo: z.string().nullable(),
      acessivel: z.boolean().nullable(),
    }),
  ),
};

@Injectable()
export class StopArrivalsTool extends McpTool {
  readonly name = 'previsao_chegada';
  private readonly logger = new Logger(StopArrivalsTool.name);

  constructor(private readonly getStopArrivals: GetStopArrivalsUseCase) {
    super();
  }

  register(server: McpServer): void {
    server.registerTool(
      this.name,
      {
        title: 'Previsão de chegada',
        description:
          'Diz quando os próximos ônibus passam numa parada, com a previsão em tempo real da SPTrans ' +
          '(ex.: "Quando passa o 875A no meu ponto?"). Use paradas_proximas para achar o código da parada.',
        inputSchema,
        outputSchema,
        annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: true },
      },
      ({ parada, linha, cidade }) =>
        runTool(this.logger, this.name, async () => {
          const city = resolveCity(cidade);
          if (!city) return toolError(unsupportedCityMessage(cidade));

          const { stopId, arrivals } = await this.getStopArrivals.execute({ stopId: parada });
          const nowMs = Date.now();
          const chegadas = arrivals
            .filter((a) => linha === undefined || matchesLine(a, linha))
            .slice(0, MAX_ARRIVALS)
            .map((a) => ({
              linha: a.routeShortName,
              destino: a.headsign,
              previsto_para: a.expectedAt,
              minutos: Math.max(0, Math.round((a.expectedAtMs - nowMs) / 60_000)),
              tempo_real: a.isRealtime,
              veiculo: a.vehicleId,
              acessivel: a.accessible,
            }));
          const structured = { cidade: city.name, parada: stopId, chegadas };

          if (chegadas.length === 0) {
            const which = linha ? ` da linha ${linha}` : '';
            return toolText(
              `Não há previsão de ônibus${which} na parada ${stopId} agora.`,
              structured,
            );
          }
          const items = chegadas.map((c) => {
            const when =
              c.minutos === 0
                ? 'chegando agora'
                : `em ${c.minutos} min (${formatClock(c.previsto_para, city.timeZone)})`;
            const extras = [
              c.tempo_real ? 'tempo real' : 'pela tabela',
              c.veiculo ? `veículo ${c.veiculo}` : null,
              c.acessivel ? 'acessível' : null,
            ].filter((e): e is string => e !== null);
            const destination = c.destino ? ` para ${c.destino}` : '';
            return `- ${c.linha}${destination}: ${when}, ${extras.join(', ')}`;
          });
          return toolText(
            [`Próximos ônibus na parada ${stopId}:`, ...items].join('\n'),
            structured,
          );
        }),
    );
  }
}

/** "875A" casa com "875A-10"; o código completo casa só com ele mesmo. */
function matchesLine(arrival: Arrival, line: string): boolean {
  const wanted = line.toUpperCase();
  const candidates = [arrival.routeShortName, arrival.routeId].map((c) => c.toUpperCase());
  return candidates.some((c) => c === wanted || c.startsWith(`${wanted}-`));
}
