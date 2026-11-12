import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { cityInput, resolveCity, unsupportedCityMessage } from '../../../../mcp/city';
import { McpTool } from '../../../../mcp/mcp-tool';
import { parseToolInput, relaxShape } from '../../../../mcp/tool-input';
import { runTool, toolError, toolText } from '../../../../mcp/tool-result';
import { SearchLinesUseCase } from '../../application/use-cases/search-lines.use-case';
import { routeTypeLabel } from './transit-mcp-format';

const DEFAULT_LIMIT = 10;

const inputSchema = {
  texto: z
    .string()
    .trim()
    .min(2, 'Digite pelo menos 2 caracteres para buscar uma linha.')
    .max(100)
    .describe(
      'Número da linha ou trecho do nome/letreiro, ex.: "875A", "Aeroporto", "Jd. Angela".',
    ),
  limite: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(`Máximo de linhas na resposta (padrão ${DEFAULT_LIMIT}).`),
  cidade: cityInput,
};

const outputSchema = {
  cidade: z.string(),
  linhas: z.array(
    z.object({
      codigo: z.string().describe('Código da linha para as outras tools, ex.: "875A-10".'),
      numero: z.string(),
      nome: z.string(),
      tipo: z.string(),
      cor: z.string().nullable(),
    }),
  ),
};

@Injectable()
export class SearchLinesTool extends McpTool {
  readonly name = 'buscar_linha';
  private readonly logger = new Logger(SearchLinesTool.name);

  constructor(private readonly searchLines: SearchLinesUseCase) {
    super();
  }

  register(server: McpServer): void {
    server.registerTool(
      this.name,
      {
        title: 'Buscar linha',
        description:
          'Busca linhas de ônibus, metrô e trem pelo número ou pelo nome (ex.: "Qual linha vai para o Aeroporto?"). ' +
          'Devolve o código de cada linha, usado em onibus_da_linha e previsao_chegada.',
        inputSchema: relaxShape(inputSchema),
        outputSchema,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      (args) =>
        runTool(this.logger, this.name, async () => {
          const input = parseToolInput(inputSchema, args);
          if (!input.ok) return input.result;
          const { texto, limite, cidade } = input.data;
          const city = resolveCity(cidade);
          if (!city) return toolError(unsupportedCityMessage(cidade));

          const { lines } = await this.searchLines.execute({
            text: texto,
            limit: limite ?? DEFAULT_LIMIT,
          });
          const linhas = lines.map((line) => ({
            codigo: line.id,
            numero: line.shortName,
            nome: line.longName,
            tipo: routeTypeLabel(line.type),
            cor: line.color,
          }));
          const structured = { cidade: city.name, linhas };

          if (linhas.length === 0) {
            return toolText(
              `Não encontrei linha para "${texto}" em ${city.name}. ` +
                'Tente o número (ex.: 875A) ou outro trecho do nome.',
              structured,
            );
          }
          const header =
            linhas.length === 1
              ? `Encontrei 1 linha para "${texto}":`
              : `Encontrei ${linhas.length} linhas para "${texto}":`;
          const items = linhas.map((l) => `- ${l.codigo}: ${l.nome} (${l.tipo})`);
          return toolText([header, ...items].join('\n'), structured);
        }),
    );
  }
}
