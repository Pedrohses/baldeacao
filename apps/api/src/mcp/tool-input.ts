// Validação da entrada das tools dentro do handler, com mensagem em português.
//
// O SDK valida o inputSchema registrado antes de chamar o handler e, se falha, devolve o erro
// cru ("MCP error -32602: Input validation error ..." em inglês). Para o usuário receber uma
// resposta amigável, a tool registra uma versão relaxada do schema (mesmos campos, tipos e
// descrições, sem limites de tamanho e faixa) e valida o schema completo no handler.
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodIssueMessage } from '../shared/presentation/zod-issues';
import { toolError } from './tool-result';

/** Mesmo campo sem limites (min, max, int, trim...); opcional e descrição ficam. */
function relax(schema: z.ZodType): z.ZodType {
  let relaxed: z.ZodType;
  if (schema instanceof z.ZodOptional) relaxed = relax(schema.unwrap() as z.ZodType).optional();
  else if (schema instanceof z.ZodString) relaxed = z.string();
  else if (schema instanceof z.ZodNumber) relaxed = z.number();
  else return schema;
  return schema.description ? relaxed.describe(schema.description) : relaxed;
}

/** Shape para o `inputSchema` do registerTool: os mesmos campos, sem os limites. */
export function relaxShape<S extends z.ZodRawShape>(shape: S): { [K in keyof S]: z.ZodType } {
  const relaxed: Record<string, z.ZodType> = {};
  for (const [key, schema] of Object.entries(shape)) relaxed[key] = relax(schema as z.ZodType);
  return relaxed as { [K in keyof S]: z.ZodType };
}

export type ToolInput<S extends z.ZodRawShape> =
  { ok: true; data: z.output<z.ZodObject<S>> } | { ok: false; result: CallToolResult };

/** Valida `args` com o schema completo; falha vira isError com o motivo em português. */
export function parseToolInput<S extends z.ZodRawShape>(shape: S, args: unknown): ToolInput<S> {
  const parsed = z.object(shape).safeParse(args ?? {});
  if (parsed.success) return { ok: true, data: parsed.data };
  const reasons = parsed.error.issues.map((issue) => {
    const field = issue.path.map(String).join('.');
    const message = zodIssueMessage(issue);
    // Mensagem customizada já é frase completa ("Informe a origem..."); a padrão leva o campo.
    return /^[A-ZÀ-Ú]/.test(message) || !field ? message : `${field}: ${message}`;
  });
  return {
    ok: false,
    result: toolError(`Entrada inválida: ${reasons.join('; ')}.`.replace('..', '.')),
  };
}
