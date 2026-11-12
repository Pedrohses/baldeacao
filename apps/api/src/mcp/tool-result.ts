import type { Logger } from '@nestjs/common';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DomainError } from '../shared/domain/errors/domain-error';

/** Resposta de sucesso: texto em português e, se houver outputSchema, os dados estruturados. */
export function toolText(text: string, structured?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

/** Falha que o modelo deve repassar ao usuário (isError), nunca uma exceção crua. */
export function toolError(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

// Mensagens que não podem sair como estão (citam configuração interna).
const FRIENDLY_BY_CODE: Record<string, string> = {
  OLHO_VIVO_AUTH_FAILED:
    'A fonte de tempo real da SPTrans (Olho Vivo) está indisponível no momento. Tente novamente em instantes.',
};

const UNEXPECTED =
  'Não consegui consultar os dados agora por uma falha interna. Tente novamente em instantes.';

/**
 * Roda o corpo da tool e converte qualquer falha em resposta amigável com isError.
 * DomainError já traz mensagem em português para o usuário; o resto vira mensagem genérica e log.
 */
export async function runTool(
  logger: Logger,
  toolName: string,
  body: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof DomainError) {
      logger.warn(`${toolName}: ${error.code}: ${error.message}`);
      return toolError(FRIENDLY_BY_CODE[error.code] ?? error.message);
    }
    logger.error(`${toolName}: falha inesperada: ${describe(error)}`);
    return toolError(UNEXPECTED);
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
