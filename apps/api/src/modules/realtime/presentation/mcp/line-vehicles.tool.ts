import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { isSnapshotStale } from '@baldeacao/types';
import { z } from 'zod';
import { cityInput, resolveCity, unsupportedCityMessage } from '../../../../mcp/city';
import { formatAge, formatClock, plural } from '../../../../mcp/format';
import { McpTool } from '../../../../mcp/mcp-tool';
import { runTool, toolError, toolText } from '../../../../mcp/tool-result';
import { GetVehicleSnapshotUseCase } from '../../application/use-cases/get-vehicle-snapshot.use-case';

const MAX_VEHICLES = 50;

const inputSchema = {
  linha: z
    .string()
    .trim()
    .min(1, 'Informe o código da linha.')
    .max(20)
    .describe('Código completo da linha, como devolvido por buscar_linha (ex.: "875A-10").'),
  cidade: cityInput,
};

const outputSchema = {
  cidade: z.string(),
  linha: z.string(),
  atualizado_em: z.string().describe('Último dado bom da fonte, ISO 8601.'),
  dados_atrasados: z.boolean(),
  total: z.number(),
  onibus: z.array(
    z.object({
      veiculo: z.string(),
      sentido: z.enum(['ida', 'volta']),
      latitude: z.number(),
      longitude: z.number(),
      lido_em: z.string(),
      acessivel: z.boolean().nullable(),
    }),
  ),
};

@Injectable()
export class LineVehiclesTool extends McpTool {
  readonly name = 'onibus_da_linha';
  private readonly logger = new Logger(LineVehiclesTool.name);

  constructor(private readonly getSnapshot: GetVehicleSnapshotUseCase) {
    super();
  }

  register(server: McpServer): void {
    server.registerTool(
      this.name,
      {
        title: 'Ônibus da linha',
        description:
          'Mostra onde estão agora os ônibus de uma linha, com a posição de cada veículo ' +
          '(ex.: "Onde estão os ônibus dessa linha agora?"). Use buscar_linha para achar o código.',
        inputSchema,
        outputSchema,
        annotations: { readOnlyHint: true, idempotentHint: false, openWorldHint: false },
      },
      ({ linha, cidade }) =>
        runTool(this.logger, this.name, async () => {
          const city = resolveCity(cidade);
          if (!city) return toolError(unsupportedCityMessage(cidade));

          const snapshot = await this.getSnapshot.execute({
            sourceId: city.sourceId,
            routeId: linha,
          });
          const now = new Date();
          const stale = isSnapshotStale(snapshot, now);
          const onibus = snapshot.vehicles.slice(0, MAX_VEHICLES).map((v) => ({
            veiculo: v.vehicleId,
            sentido: v.directionId === 0 ? ('ida' as const) : ('volta' as const),
            latitude: v.location.lat,
            longitude: v.location.lon,
            lido_em: v.recordedAt,
            acessivel: v.accessible,
          }));
          const structured = {
            cidade: city.name,
            linha,
            atualizado_em: snapshot.updatedAt,
            dados_atrasados: stale,
            total: snapshot.vehicles.length,
            onibus,
          };

          const age = formatAge(now.getTime() - Date.parse(snapshot.updatedAt));
          const freshness = `dados das ${formatClock(snapshot.updatedAt, city.timeZone)}, ${age}`;
          const warning = stale
            ? '\nAtenção: o tempo real está atrasado, as posições podem estar desatualizadas.'
            : '';

          if (onibus.length === 0) {
            const hint = linha.includes('-')
              ? ''
              : ' Confira o código completo da linha (ex.: 875A-10) com buscar_linha.';
            return toolText(
              `Nenhum ônibus da linha ${linha} com posição agora (${freshness}).${hint}${warning}`,
              structured,
            );
          }
          const header = `${plural(snapshot.vehicles.length, 'ônibus', 'ônibus')} da linha ${linha} agora (${freshness}):`;
          const items = onibus.map(
            (o) =>
              `- veículo ${o.veiculo}, sentido ${o.sentido}: ${o.latitude.toFixed(5)}, ${o.longitude.toFixed(5)} ` +
              `(lido às ${formatClock(o.lido_em, city.timeZone)})${o.acessivel ? ', acessível' : ''}`,
          );
          const more =
            snapshot.vehicles.length > onibus.length
              ? [`(mostrando ${onibus.length} de ${snapshot.vehicles.length})`]
              : [];
          return toolText([header, ...items, ...more].join('\n') + warning, structured);
        }),
    );
  }
}
