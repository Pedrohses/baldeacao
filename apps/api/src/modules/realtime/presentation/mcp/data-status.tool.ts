import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isSnapshotStale, REALTIME_CYCLE_MS, REALTIME_STALE_AFTER_MS } from '@baldeacao/types';
import { z } from 'zod';
import { cityInput, resolveCity, unsupportedCityMessage } from '../../../../mcp/city';
import { formatAge, formatClock, plural } from '../../../../mcp/format';
import { McpTool } from '../../../../mcp/mcp-tool';
import { runTool, toolError, toolText } from '../../../../mcp/tool-result';
import { GetVehicleSnapshotUseCase } from '../../application/use-cases/get-vehicle-snapshot.use-case';
import { RealtimeDataNotReadyError } from '../../domain/errors/realtime-data-not-ready.error';

const inputSchema = { cidade: cityInput };

const outputSchema = {
  cidade: z.string(),
  situacao: z.enum(['atualizado', 'atrasado', 'sem_dados']),
  atualizado_em: z.string().nullable().describe('Último dado bom da fonte, ISO 8601.'),
  idade_segundos: z.number().nullable(),
  limite_atraso_segundos: z.number(),
  onibus_com_posicao: z.number(),
};

@Injectable()
export class DataStatusTool extends McpTool {
  readonly name = 'status_dados';
  private readonly logger = new Logger(DataStatusTool.name);

  constructor(private readonly getSnapshot: GetVehicleSnapshotUseCase) {
    super();
  }

  register(server: McpServer): void {
    server.registerTool(
      this.name,
      {
        title: 'Status dos dados',
        description:
          'Diz se os dados de tempo real (posição dos ônibus) estão atualizados e de quando é o último dado ' +
          '(ex.: "Os dados de tempo real estão atualizados?").',
        inputSchema,
        outputSchema,
        annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
      },
      ({ cidade }) =>
        runTool(this.logger, this.name, async () => {
          const city = resolveCity(cidade);
          if (!city) return toolError(unsupportedCityMessage(cidade));
          const limitSeconds = REALTIME_STALE_AFTER_MS / 1000;

          let snapshot;
          try {
            snapshot = await this.getSnapshot.execute({ sourceId: city.sourceId, routeId: null });
          } catch (error) {
            if (!(error instanceof RealtimeDataNotReadyError)) throw error;
            return toolText(
              `Ainda não há dados de tempo real para ${city.name}: o worker não gravou nenhuma leitura. ` +
                'Previsões de chegada e posições dos ônibus podem não estar disponíveis.',
              {
                cidade: city.name,
                situacao: 'sem_dados',
                atualizado_em: null,
                idade_segundos: null,
                limite_atraso_segundos: limitSeconds,
                onibus_com_posicao: 0,
              },
            );
          }

          const now = new Date();
          const ageMs = now.getTime() - Date.parse(snapshot.updatedAt);
          const stale = isSnapshotStale(snapshot, now);
          const when = `${formatClock(snapshot.updatedAt, city.timeZone, true)} (${formatAge(ageMs)})`;
          const count = plural(snapshot.vehicles.length, 'ônibus', 'ônibus');
          const text = stale
            ? `Os dados de tempo real de ${city.name} estão atrasados: o último dado bom é das ${when}. ` +
              `O normal é atualizar a cada ${REALTIME_CYCLE_MS / 1000} s. ${count} com a última posição conhecida.`
            : `Os dados de tempo real de ${city.name} estão atualizados: último dado às ${when}, ${count} com posição.`;
          return toolText(text, {
            cidade: city.name,
            situacao: stale ? 'atrasado' : 'atualizado',
            atualizado_em: snapshot.updatedAt,
            idade_segundos: Math.max(0, Math.round(ageMs / 1000)),
            limite_atraso_segundos: limitSeconds,
            onibus_com_posicao: snapshot.vehicles.length,
          });
        }),
    );
  }
}
